---
title: "Shift Auto Planner (SAP) - Technical Documentation"
subtitle: "BNC / Axians - Internal Operations"
date: "March 2026"
author: "BNC Internal Operations"
---

\newpage

# 1. Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Frontend Framework** | Next.js (App Router) | 16.1.6 |
| **UI Library** | React | 19.2.4 |
| **Language** | TypeScript | 5.x |
| **CSS Framework** | Tailwind CSS | 4.2.1 |
| **UI Components** | Radix UI | Various |
| **Icons** | Lucide React | 0.575.0 |
| **ORM / Database Client** | Prisma | 7.4.1 |
| **Database Driver** | @prisma/adapter-pg | 7.4.1 |
| **Database** | PostgreSQL | 16 (Alpine) |
| **Authentication** | MSAL (Azure AD / Entra ID) | msal-browser 4.29, msal-react 3.0.27 |
| **JWT Validation** | jose | 6.1.3 |
| **Internationalization** | next-intl | 4.8.3 |
| **Schema Validation** | Zod | 4.3.6 |
| **Reverse Proxy** | Nginx | stable |
| **Container Runtime** | Docker + Docker Compose | 27.x |
| **Container OS** | Alpine Linux (node:20-alpine) | Node 20.20 |
| **Host OS (Production)** | AlmaLinux | 9.x |
| **CI/CD** | GitLab CI/CD | - |

\newpage

# 2. Architecture

## 2.1 Authentication Flow

```
+----------------+     +-------------------+     +----------------+     +------------------+
|                |     |                   |     |                |     |                  |
|  User          +---->+  Login (Azure AD) +---->+  Entra ID MFA  +---->+  SAP Web UI      |
|  (Browser)     |     |  Vinci Energies   |     |                |     |                  |
+----------------+     +-------------------+     +----------------+     +------------------+
```

1. User clicks "Login with Azure AD"
2. MSAL redirects to Microsoft Entra ID
3. User authenticates with MFA
4. Entra ID returns an access token (delegated permissions)
5. All API calls include the token as `Authorization: Bearer <token>`

**Token validation (server-side — `lib/auth.ts`):**
- Primary: JWKS validation via `jose` library (JSON Web Key Set from Microsoft)
- Fallback: Microsoft Graph `/me` endpoint validation (for Graph API access tokens)
- Caching: Validated tokens are cached in-memory until expiration (minus 60s margin)
- Cache cleanup: Runs every 60 seconds

## 2.2 Data Flow — Outlook Integration

```
+---------------------+                          +------------------+
|                     |  1. Read calendars (OOF)  |                  |
|  Shift Auto Planner +<-------------------------+  Microsoft       |
|                     |                           |  Outlook         |
|                     +-------------------------->+  (Exchange       |
|                     |  2. Send shift invitations |   Online)       |
|                     |                           |                  |
|                     +<--------------------------+                  |
|                     |  3. Event responses        |                  |
+---------------------+  (Accept/Refuse)          +------------------+
```

**Step 1 — Read user calendars (OOF):**
- Uses `POST /me/calendar/getSchedule` (Microsoft Graph)
- Batches of 20 users (Graph API limit)
- Timezone: `Europe/Zurich`
- Both `oof` and `busy` statuses → unavailable
- End date correction: Graph returns exclusive end dates, SAP subtracts 1 day

**Step 2 — Send shift invitations:**
- Creates events via `POST /users/{mailbox}/calendar/events`
- Uses the shift's shared mailbox as organizer
- Invitations are sent in **parallel batches of 5** using `Promise.allSettled` for performance
- A real-time progress dialog shows success/error counts during sending
- Outlook event ID stored in `ShiftAssignment.outlookEventId`

**Step 3 — Sync responses:**
- Manual: Dashboard Sync button → `POST /api/outlook/sync`
- Automated: `GET /api/cron/sync-outlook-responses` (secured by CRON_SECRET)
- Maps: `accepted` → ACCEPTED, `tentativelyaccepted` → TENTATIVE, `declined` → REFUSED
- Refused: Attempts to cancel the Outlook event

## 2.3 Infrastructure

```
+--------------------------------------------------+
|  AlmaLinux Production Server                      |
|                                                   |
|  +---------------------------------------------+ |
|  | Docker Network: sap-network                  | |
|  |                                              | |
|  |  +-----------+   +----------+   +----------+ | |
|  |  |           |   |          |   |          | | |
|  |  |  nginx    +-->+  sap-app +-->+ postgres | | |
|  |  |  :8443    |   |  :3000   |   |  :5432   | | |
|  |  |  (HTTPS)  |   | (Next.js)|   | (DB)     | | |
|  |  |           |   |          |   |          | | |
|  |  +-----------+   +----------+   +----------+ | |
|  |                                              | |
|  +---------------------------------------------+ |
+--------------------------------------------------+
```

| Service | Image | Port | Role |
|---------|-------|------|------|
| `sap-nginx` | nginx:stable | 8080 (HTTP) / 8443 (HTTPS) | TLS termination, security headers, reverse proxy |
| `sap-app` | sap-app:latest (custom) | 3000 | Next.js application server |
| `sap-postgres` | postgres:16-alpine | 5432 (internal only) | PostgreSQL database |

- PostgreSQL is **never exposed** outside the Docker network
- Nginx handles TLS with a self-signed certificate (auto-generated on first boot)
- The app runs as unprivileged user `nextjs:nodejs` (UID 1001)

\newpage

# 3. Scheduling Algorithm

## 3.1 Processing Order

```
+-------------------+     +--------------------+     +---------------------+
|  PART 1           |     |  PART 2.1          |     |  PART 2.2           |
|  Pikett           +---->+  Rotation          +---->+  Fair Distribution  |
|  (weekly rotation)|     |  Patterns          |     |  (remaining slots)  |
+-------------------+     +--------------------+     +----------+----------+
                                                                |
                                                                v
                                                     +----------+----------+
                                                     |  POST-PROCESSING    |
                                                     |  DOUBLE_SHIFT       |
                                                     |  (auto-link)        |
                                                     +---------------------+
```

## 3.2 PART 1 — Pikett Assignment (Weekly Rotation)

Assigns one user per pikett per week, rotating through eligible members.

```
For each pikett:
  For each week:
    While (user not found AND attempts < eligible count):
      candidate = next user in rotation

      CHECK 1: Not same person as previous week (consecutive avoidance)
      CHECK 2: WEEK_PARITY rule — if odd/even mismatch → skip
      CHECK 3: OOF availability — if unavailable > 2 days in the week → skip

      If all checks pass → assign this user for the week

    For each day in the week:
      CHECK: Public holiday → mark unavailable
      CHECK: OOF on this specific day → mark unavailable
      If all pass → create assignment
```

If no user passes all checks, the slot is left **unassigned**.

## 3.3 PART 2.1 — Rotation Pattern Assignment

Places users who have an assigned rotation pattern on their designated shifts.

Condition: Only runs if "Enable rotations" setting is ON.

Rotation assignments use a **2-pass system**: all rotation assignments are processed across ALL dates BEFORE normal shift assignment begins. This ensures the `assignedNormalShiftSet` is fully populated before fair distribution runs.

```
For ALL dates first (before any normal assignment):
  For each user with a rotation pattern:
    CHECK: Shift is in the selected shifts for this plan
    CHECK: Not already assigned (e.g., by PART 1)
    CHECK: Not on public holiday
    CHECK: Not OOF (if calendar check enabled)
    CHECK: WEEK_PARITY rule matches
    CHECK: User is eligible for this shift
    CHECK: Part-time / work schedule (respectWorkPercentage)
    CHECK: Consecutive shift avoidance (per-shift minConsecutiveDays)

    If all pass → create assignment (marked as rotation assignment)
```

Uses ISO week numbers for cycle position — ensures continuity across planning periods.

## 3.4 PART 2.2 — Fair Distribution (Regular Shifts)

Fills remaining shift slots fairly among eligible users.

**Constraint checking order (for each user × date × shift):**

```
PRIORITY 1: PUBLIC HOLIDAYS → per user canton
PRIORITY 2: WORK AVAILABILITY → morning/afternoon schedule
PRIORITY 2.5: WEEK PARITY → WEEK_PARITY rule
PRIORITY 3: ALREADY ASSIGNED → another shift today
PRIORITY 4: OUTLOOK CALENDAR → OOF/busy check
PRIORITY 5: CONSECUTIVE SHIFTS → per-shift minConsecutiveDays check
PRIORITY 6: MAX LOAD → MAX_LOAD rule limit
```

**Selection among available users:**

```
PASS 0: Consecutive Days Preference
  - Each shift has a `minConsecutiveDays` setting (1-3)
  - If minConsecutiveDays > 1, the algorithm tries to keep the same person for N consecutive days
  - Below minimum: always keep same user (do not rotate)
  - At/above minimum: keep if user's ratio ≤ 1.2× average of others (fair distribution check)
  - Uses a `shiftConsecutiveTracker` map per shift to track current streak

PASS 1: Round-robin — pick next user in weekly queue, skip if already assigned this week
PASS 2: Ratio-based — if all assigned this week, select user with lowest ratio
```

## 3.5 Post-Processing — DOUBLE_SHIFT

After all assignments, automatically adds linked shift assignments.

```
For each pass (max 5, for chaining):
  For each assignment:
    For each assigned user:
      Find DOUBLE_SHIFT rules where triggerShiftId = assignment.shiftId

      For each triggered rule:
        CHECK: Not already assigned to linked shift on this date
        CHECK: If linked is a pikett → replaces normal rotation user
        CHECK: MAX_LOAD rule on linked shift
        CHECK: Part-time / work schedule for linked shift
        CHECK: Public holiday for linked shift user
        CHECK: OOF availability for linked shift (if calendar check enabled)

        If all pass → create linked assignment

  If no new assignments → stop
  Otherwise → new assignments become source for next pass
```

Chaining: If A has SEC→CDC and CDC→Devops, Pass 1 adds CDC, Pass 2 adds Devops.

\newpage

# 4. Database Schema

## 4.1 Entity Relationship

```
 Team 1───* Shift 1───* ShiftAssignment *───1 User
  |                                           |
  +───* Pikett                                |
  +───* User (members)                        |
  +───? User (lead, unique)                   |
                                       User ──* UserRule
                                              +--> type: WEEK_PARITY | DOUBLE_SHIFT | MAX_LOAD
                                              +--> config: JSON
                                              +--> enabled: Boolean

 RotationPattern  (standalone templates, linked to User via rotationConfig JSON)
 Holiday          (standalone reference data, matched by canton)
 OutOfOfficeEvent (linked to User by email)
 AuditLog         (standalone audit trail)
```

## 4.2 Models

### User

| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| email | String (unique) | Microsoft email |
| firstName / lastName | String | Full name |
| phone | String? | Phone number |
| location | String? | Canton code (BE, ZH, VD) |
| role | String? | Job role |
| workPercent | Int (0-100) | Default 100 |
| status | ACTIVE / INACTIVE | User status |
| rotationConfig | JSON? | `{ patternId }` |
| availability | JSON? | Weekly schedule (morning/afternoon per day) |
| teamId | String? | FK to Team |

### Team

| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| name | String | Team name |
| description | String? | Description |
| color | String | Hex color code |
| leadId | String? (unique) | FK to User |

### Shift

| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| name | String | Shift name |
| startTime / endTime | String | Format "HH:MM" |
| daysOfWeek | Int[] | Active days (0=Sun, 1=Mon, ...) |
| membersRequired | Int | People needed per shift |
| priority | LOW / MEDIUM / HIGH / CRITICAL | Shift priority |
| status | ACTIVE / INACTIVE / ARCHIVED | Shift status |
| color | String | Hex color code |
| minConsecutiveDays | Int (default 1) | Consecutive days target (1-3) |
| senderMailbox | String | Shared mailbox for invites |
| includedUserIds / excludedUserIds | String[] | Allow/deny lists |
| teamId | String | FK to Team |

### Pikett

| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| name | String | Pikett name |
| startWeek / endWeek | String | ISO week format |
| daysOfWeek | Int[] | Active days |
| is24_7 | Boolean | 24/7 flag |
| teamId | String | FK to Team |
| userId | String? | FK to assigned User |
| includedUserIds / excludedUserIds | String[] | Allow/deny lists |

### ShiftAssignment

| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| date | DateTime | Assignment date |
| status | PENDING / ACCEPTED / REFUSED / CANCELLED | Response status |
| outlookEventId | String? | Graph event ID |
| resent | Boolean | Was this resent? |
| shiftId | String | FK to Shift |
| userId | String | FK to User |

Unique constraint: `[date, shiftId, userId]`

### UserRule

| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| userId | String | FK to User (cascade delete) |
| type | WEEK_PARITY / DOUBLE_SHIFT / MAX_LOAD | Rule type |
| config | JSON | Type-specific config |
| enabled | Boolean | Toggle on/off |

**Config per type:**

| Type | Config | Example |
|------|--------|---------|
| WEEK_PARITY | `{ "parity": "odd" \| "even" }` | `{ "parity": "odd" }` |
| DOUBLE_SHIFT | `{ "triggerShiftId": "...", "linkedShiftId": "..." }` | Trigger → linked |
| MAX_LOAD | `{ "shiftId": "...", "maxPercentage": 50 }` | Max 50% |

**Validation rules:**
- WEEK_PARITY: 1 per user
- DOUBLE_SHIFT: 1 per trigger shift; trigger ≠ linked
- MAX_LOAD: 1 per shift per user; percentage 1-100%
- Orphan cleanup: Deleting a shift/pikett auto-deletes referencing UserRules

### Other Models

- **RotationPattern**: Multi-week cycle templates (name, cycleLength, weeks JSON, userShifts)
- **Holiday**: Public holidays (name, date, cantons, type, recurring)
- **OutOfOfficeEvent**: Synced OOF from Outlook, linked by `userEmail`
- **AuditLog**: Audit trail with entity, action, JSON data (auto-cleaned after 90 days)

\newpage

# 5. API Reference

## 5.1 Authentication

All endpoints require `Authorization: Bearer <token>` except:
- `GET /api/cron/sync-outlook-responses` (uses CRON_SECRET header)

## 5.2 Endpoints

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/teams` | GET, POST | List / create teams |
| `/api/teams/{id}` | GET, PUT, DELETE | CRUD team |
| `/api/users` | GET, POST | List / create users (includes rules) |
| `/api/users/{id}` | GET, PUT, DELETE | CRUD user (includes rules) |
| `/api/users/{id}/rules` | GET, POST | List / create user rules |
| `/api/users/{id}/rules/{ruleId}` | PUT, DELETE | Update / delete rule |
| `/api/shifts` | GET, POST | List / create shifts |
| `/api/shifts/{id}` | GET, PUT, DELETE | CRUD shift (cleans orphaned rules) |
| `/api/piketts` | GET, POST | List / create piketts |
| `/api/piketts/{id}` | PUT, DELETE | CRUD pikett (cleans orphaned rules) |
| `/api/shift-assignments` | GET, POST | List (filtered) / bulk create |
| `/api/shift-assignments/{id}` | GET, PUT, PATCH, DELETE | CRUD assignment |
| `/api/shift-assignments/stats` | GET | Statistics |
| `/api/holidays` | GET, POST | List / create holidays |
| `/api/holidays/{id}` | PUT, DELETE | CRUD holiday |
| `/api/holidays/import` | POST | Import Swiss holidays |
| `/api/holidays/import-csv` | POST | Import from CSV |
| `/api/rotation-patterns` | GET, POST | List / create patterns |
| `/api/rotation-patterns/{id}` | GET, PUT, DELETE | CRUD pattern |
| `/api/outlook/send-event` | POST, DELETE | Create / cancel Outlook event |
| `/api/outlook/sync` | POST | Sync Outlook responses |
| `/api/backup` | GET, POST | List / create backup |
| `/api/backup/{fileName}` | DELETE | Delete backup file |
| `/api/backup/download/{fileName}` | GET | Download backup |
| `/api/backup/restore` | POST | Restore from backup |
| `/api/audit-logs/cleanup` | DELETE | Cleanup logs older than 90 days |
| `/api/cron/sync-outlook-responses` | GET, POST | Cron: auto-sync responses |

## 5.3 Rate Limiting

All endpoints are rate-limited via `lib/rateLimit.ts` (in-memory sliding window):

| Profile | Limit | Window |
|---------|-------|--------|
| Standard (GET) | 100 requests | 60 seconds |
| Write (POST/PUT/DELETE) | 30 requests | 60 seconds |
| Backup | 5 requests | 60 seconds |
| Restore | 2 requests | 300 seconds |

Rate limits are per IP + pathname combination.

\newpage

# 6. Security

## 6.1 Authentication & Authorization

- Azure AD token validation: JWKS (primary) + Graph /me (fallback)
- Token cache: In-memory with TTL matching token expiration
- All API routes protected by `requireAuth()` middleware
- CORS: Configured in `middleware.ts`

## 6.2 Security Headers (Nginx)

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `server_tokens off`

## 6.3 Security Logging

`lib/securityLogger.ts` logs events with `[SECURITY]` prefix:
- AUTH_FAILURE, AUTH_SUCCESS
- RATE_LIMIT_HIT, CORS_BLOCKED
- PATH_TRAVERSAL_ATTEMPT, VALIDATION_FAILURE
- BACKUP_CREATED, BACKUP_RESTORED
- CRON_AUTH_FAILURE, AUDIT_LOGS_CLEANUP

## 6.4 Input Validation

All API inputs validated with Zod schemas (`lib/validation.ts`). Path traversal protection on backup file operations.

\newpage

# 7. Deployment

## 7.1 Prerequisites

- AlmaLinux 9.x server (minimal install)
- Microsoft Azure AD (Entra ID) app registration (see Section 7.2)
- Network access to `login.microsoftonline.com` and `graph.microsoft.com`
- SSH access to the server with sudo privileges

## 7.2 Azure AD App Registration

1. Azure Portal > Entra ID > App registrations > New
2. Name: `Shift Auto Planner`, Single tenant
3. Redirect URI: SPA > `https://<DOMAIN>:8443`

**API Permissions (Delegated):**

| Permission | Purpose |
|------------|---------|
| `User.Read` | Read user profile |
| `Calendars.Read` | Read calendars for OOF |
| `Calendars.ReadWrite` | Create/cancel events |
| `Calendars.ReadWrite.Shared` | Access shared mailbox calendars |

Grant admin consent.

**Values to note:**
- Application (client) ID → `AZURE_AD_CLIENT_ID` / `NEXT_PUBLIC_AZURE_AD_CLIENT_ID`
- Directory (tenant) ID → `AZURE_AD_TENANT_ID` / `NEXT_PUBLIC_AZURE_AD_TENANT_ID`
- Client secret → `AZURE_AD_CLIENT_SECRET`

**Redirect URIs:**
- `https://<DOMAIN>:8443` (production)
- `http://localhost:3000` (development)
- Enable: Access tokens + ID tokens

## 7.3 Server Setup — Fresh AlmaLinux Installation

### Step 1: System Update

```bash
sudo dnf update -y
sudo dnf install -y git nano curl wget
```

### Step 2: Install Docker Engine

```bash
# Add Docker repository
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Install Docker + Compose plugin
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group (avoids sudo for docker commands)
sudo usermod -aG docker $USER
newgrp docker
```

### Step 3: Install Node.js (for local Prisma commands / development)

```bash
# Install Node.js 20 LTS via NodeSource
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# Verify
node -v  # v20.x
npm -v
```

> **Note:** Node.js on the host is optional — only needed if you want to run Prisma Studio locally (`npx prisma studio --url postgresql://...`), run tests, or develop directly on the server. The application itself runs inside Docker containers.

### Step 4: Configure Firewall

```bash
# Allow HTTPS (8443) and HTTP (8080) for Nginx
sudo firewall-cmd --permanent --add-port=8443/tcp
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload

# Verify
sudo firewall-cmd --list-ports
```

### Step 5: Clone and Configure

```bash
cd /opt
sudo git clone <REPO_URL> SAP_Almalinux
sudo chown -R $USER:$USER SAP_Almalinux
cd SAP_Almalinux

# Create environment file
cp .env.example .env   # or create manually
nano .env              # Fill in all values (see Section 7.4)
```

### Step 6: Configure Nginx Domain

Edit the domain name in these files:
- `nginx/conf.d/sap.conf` — replace `sap.lab.sr.bnc.ch` with your domain
- `nginx/init-certs.sh` — replace `sap.lab.sr.bnc.ch` with your domain
- `nginx/sap-san.cnf` — replace `sap.lab.sr.bnc.ch` with your domain

### Step 7: Build and Start

```bash
# Build the application image (first time, takes ~2-3 minutes)
docker compose build --no-cache app

# Start all services (postgres, app, nginx)
docker compose up -d

# Verify all 3 containers are running
docker ps
```

Expected output: 3 containers running — `sap-postgres`, `sap-app`, `sap-nginx`.

### Step 8: Verify Deployment

```bash
# Check app logs
docker logs -f sap-app

# Expected: "Application disponible sur http://0.0.0.0:3000"

# Test HTTPS access
curl -k https://localhost:8443
```

Open `https://<YOUR_DOMAIN>:8443` in your browser. You should see the login page.

## 7.4 Environment Variables

| Variable | Required | Build-time | Description |
|----------|----------|------------|-------------|
| `DATABASE_URL` | Yes | No | PostgreSQL connection string |
| `AZURE_AD_CLIENT_ID` | Yes | No | App client ID (server) |
| `AZURE_AD_CLIENT_SECRET` | Yes | No | App secret (server) |
| `AZURE_AD_TENANT_ID` | Yes | No | Tenant ID (server) |
| `NEXT_PUBLIC_AZURE_AD_CLIENT_ID` | Yes | **Yes** | Client ID (browser) |
| `NEXT_PUBLIC_AZURE_AD_TENANT_ID` | Yes | **Yes** | Tenant ID (browser) |
| `NEXT_PUBLIC_AZURE_AD_REDIRECT_URI` | Yes | **Yes** | OAuth redirect URI |
| `NEXT_PUBLIC_URL` | Yes | No | Public app URL |
| `CRON_SECRET` | Yes | No | Cron job auth secret |
| `NEXT_PUBLIC_CRON_SECRET` | Yes | **Yes** | Cron secret (browser) |
| `MICROSOFT_GRAPH_REFRESH_TOKEN` | No | No | Optional Graph refresh token |

**Build-time = Yes** → baked into JS bundle during build. Changing requires rebuild.

## 7.5 Container Startup Sequence

`docker-entrypoint.sh`:
1. Wait for database (30 retries, 2s each)
2. Run Prisma migrations (fallback: `prisma db push`)
3. Fix backup directory permissions
4. Start Next.js as unprivileged user (UID 1001)

## 7.6 Updating

```bash
git pull
docker compose build --no-cache app
docker compose up -d app
```

Always use `--no-cache` to ensure code changes are included.

## 7.7 Nginx Configuration

- HTTP :8080 → redirects to HTTPS :8443
- Self-signed certificates auto-generated via `nginx/init-certs.sh`
- TLS 1.2 + 1.3, RSA 2048-bit, 365-day validity

**Change domain:**
1. Edit `nginx/conf.d/sap.conf`
2. Edit `nginx/sap-san.cnf`
3. `docker volume rm sap_almalinux_nginx-certs && docker compose restart nginx`

\newpage

# 8. CI/CD Pipeline (GitLab)

```
git push main → Build Docker → Push to registry → SSH deploy → Health check
```

**Required GitLab CI/CD Variables:**

| Variable | Masked | Value |
|----------|--------|-------|
| `SSH_PRIVATE_KEY` | Yes | SSH key for server |
| `SSH_KNOWN_HOSTS` | No | `ssh-keyscan` output |
| `SSH_USER` | No | SSH username |
| `SSH_HOST` | No | Server IP/hostname |
| `DEPLOY_PATH` | No | e.g., `/opt/SAP_Almalinux` |
| `NEXT_PUBLIC_AZURE_AD_CLIENT_ID` | No | Client ID |
| `NEXT_PUBLIC_AZURE_AD_TENANT_ID` | No | Tenant ID |
| `NEXT_PUBLIC_AZURE_AD_REDIRECT_URI` | No | Redirect URI |
| `NEXT_PUBLIC_CRON_SECRET` | Yes | Cron secret |

\newpage

# 9. Updating Dependencies

## Key Packages

| Package | Update command | Impact |
|---------|----------------|--------|
| **Next.js** | `npm install next@latest eslint-config-next@latest` | High |
| **React** | `npm install react@latest react-dom@latest` | High |
| **Prisma** | `npm install prisma@latest @prisma/client@latest @prisma/adapter-pg@latest` then `npx prisma generate` | High |
| **MSAL** | `npm install @azure/msal-browser@latest @azure/msal-react@latest` | Medium |
| **next-intl** | `npm install next-intl@latest` | Medium |
| **Tailwind** | `npm install tailwindcss@latest @tailwindcss/postcss@latest` | Low |
| **Zod** | `npm install zod@latest` | Low |

## Node.js Version (Docker)

Edit `Dockerfile` — change `node:20-alpine` to `node:22-alpine` on all 3 stages.
Stay on LTS versions (20, 22, 24...).

## PostgreSQL Version

1. Create a backup first
2. Edit `docker-compose.yml`: change `postgres:16-alpine` to `postgres:17-alpine`
3. `docker compose down && docker volume rm sap_almalinux_postgres-data`
4. `docker compose up -d` → restore via Settings

\newpage

# 10. Project Structure

```
SAP_Almalinux/
|-- app/
|   |-- [locale]/           # i18n pages (en, fr, de)
|   |   |-- page.tsx         # Login page
|   |   |-- dashboard/       # Dashboard
|   |   |-- planner/         # Planner
|   |   |-- users/           # Users, Teams, Rules, Rotation Patterns
|   |   |-- shifts/          # Shifts & Piketts
|   |   |-- settings/        # Settings, Holidays, Backup
|   |   +-- layout.tsx       # Auth + i18n providers
|   +-- api/                 # REST API routes
|       |-- teams/
|       |-- users/
|       |   +-- [id]/rules/  # User rules API
|       |-- shifts/
|       |-- piketts/
|       |-- shift-assignments/
|       |-- holidays/
|       |-- rotation-patterns/
|       |-- outlook/
|       |-- backup/
|       |-- audit-logs/
|       +-- cron/
|-- lib/                     # Shared libraries
|   |-- auth.ts              # Azure AD token validation
|   |-- prisma.ts            # Prisma client singleton
|   |-- rateLimit.ts         # Rate limiter
|   |-- validation.ts        # Zod schemas
|   |-- securityLogger.ts    # Security event logging
|   |-- hooks/               # React hooks (useAuthFetch, etc.)
|   +-- msalConfig.ts        # MSAL configuration
|-- contexts/                # React contexts
|   |-- AuthContext.tsx       # Authentication
|   |-- AutoSyncContext.tsx   # Auto Outlook sync
|   |-- AutoBackupContext.tsx # Scheduled backup + log cleanup
|   +-- RotationPatternsContext.tsx
|-- prisma/
|   |-- schema.prisma        # Database schema
|   +-- migrations/
|-- messages/                # i18n (en.json, fr.json, de.json)
|-- i18n/                    # i18n config
|-- nginx/                   # Nginx config + certs
|-- scripts/                 # Backup/restore scripts
|-- docs/                    # Documentation
|-- docker-compose.yml
|-- Dockerfile
|-- docker-entrypoint.sh
|-- prisma.config.ts
+-- .gitlab-ci.yml
```

\newpage

# 11. Troubleshooting

## Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| 500 errors on all API routes | SSL issue with Prisma 7 | Ensure `sslmode=prefer` is not in DATABASE_URL |
| Login redirect fails | Wrong redirect URI | Verify `NEXT_PUBLIC_AZURE_AD_REDIRECT_URI` matches Azure Portal |
| Calendar events not sent | Missing Graph permissions | Ensure `Calendars.ReadWrite` + `.Shared` are consented |
| OOF not detected | Email mismatch | User email must match Microsoft account exactly |
| Container exits | Database not ready | Check `docker logs sap-app` — retries 30 times |
| Build uses old code | Docker cache | Always use `--no-cache` |
| Build fails (Turbopack) | Webpack config | Build uses `--webpack` flag |
| User rules not applied | Rules disabled | Check `enabled: true` toggle |
| DOUBLE_SHIFT pikett conflict | Two rules target same pikett | First processed wins |
| 401 on all APIs | Docker network issue | Check container connectivity to graph.microsoft.com |

## Useful Commands

```bash
docker ps                                           # Container status
docker compose logs -f                              # All logs
docker logs -f sap-app                              # App logs
docker compose restart app                          # Restart app
docker compose build --no-cache app && docker compose up -d app  # Rebuild

# Database access
docker exec -it sap-postgres psql -U sa_sap -d shiftautoplanner
docker exec -it sap-postgres psql -U sa_sap -d shiftautoplanner -c "\dt"

# Check user rules
docker exec -it sap-postgres psql -U sa_sap -d shiftautoplanner \
  -c 'SELECT u."firstName", u."lastName", r."type", r."config", r."enabled" FROM "UserRule" r JOIN "User" u ON r."userId" = u."id"'

# Count assignments per user
docker exec -it sap-postgres psql -U sa_sap -d shiftautoplanner \
  -c 'SELECT u."firstName", u."lastName", COUNT(a.id) as total FROM "User" u LEFT JOIN "ShiftAssignment" a ON u.id = a."userId" GROUP BY u.id ORDER BY total DESC'
```

## Debugging the Planner

1. Click the problematic day → check unavailable users and reasons
2. Check user rules: Users > Edit user > Rules
3. Check rotation patterns: verify cycle week matches
4. Check holidays: Settings > Holidays (correct year + cantons)
5. Check availability: Users > Edit user > Availability

## Logs

- **Application**: `docker logs -f sap-app`
- **Security**: `[SECURITY]` prefixed entries in app logs
- **Audit trail**: `AuditLog` table (auto-cleaned after 90 days)
- **Docker log rotation**: json-file driver with max-size limits
