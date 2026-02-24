---
title: "Shift Auto Planner (SAP) - Technical Handover Documentation"
subtitle: "BNC / Axians - Internal Operations"
date: "February 2026"
author: "BNC Internal Operations"
---

\newpage

# 1. Project Overview

## 1.1 What is Shift Auto Planner?

Shift Auto Planner (SAP) is an internal web application that **automates the scheduling of on-call shifts (pikett) and regular work shifts** for BNC/Axians teams. It integrates with Microsoft Outlook to send calendar invitations and track responses (accepted/refused/pending).

**Key capabilities:**

- Automatic shift assignment respecting constraints (holidays, OOF, availability, rotations)
- Microsoft Outlook calendar integration (send invitations, sync responses)
- Multi-team, multi-shift management
- On-call (pikett) scheduling
- Database backup and restore
- Multi-language support (English, French, German)

## 1.2 Technology Stack

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
| **Source Control** | Git (GitHub + GitLab) | - |
| **Linter** | ESLint | 10.x |

\newpage

# 2. Architecture

## 2.1 Authentication Flow

```
+----------------+     +-------------------+     +----------------+     +------------------+
|                |     |                   |     |                |     |                  |
|  Shift Planner +---->+  Login (Azure AD) +---->+  Entra ID MFA  +---->+  SAP Web UI      |
|  (User)        |     |  Vinci Energies   |     |                |     |                  |
|                |     |  Entra ID         |     |                |     |                  |
+----------------+     +-------------------+     +----------------+     +------------------+
```

1. User clicks "Login with Azure AD" on the SAP login page
2. MSAL redirects to Microsoft Entra ID (Azure AD) login
3. User authenticates with MFA (Multi-Factor Authentication)
4. Entra ID returns an access token (delegated permissions)
5. SAP Web UI stores the token in session storage
6. All API calls include the token as `Authorization: Bearer <token>`

**Token validation (server-side):** The API validates tokens using JWKS (JSON Web Key Set) from Microsoft, with a fallback to Microsoft Graph `/me` endpoint validation.

## 2.2 Data Flow

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

1. **Read user calendars:** The planner reads Out-of-Office (OOF) and busy status via Microsoft Graph `getSchedule` API to determine user availability
2. **Send shift invitations:** After generating the plan, Outlook calendar events are created for each assignment via Graph API
3. **Sync responses:** The app periodically syncs attendee responses (Accepted/Refused) from Outlook back to the database

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
         ^
         |  HTTPS :8443
         |
    +----+----+
    |  Users  |
    | (Browser)|
    +----------+
```

| Service | Image | Port | Role |
|---------|-------|------|------|
| `sap-nginx` | nginx:stable | 8080 (HTTP) / 8443 (HTTPS) | TLS termination, security headers, reverse proxy |
| `sap-app` | sap-app:latest (custom) | 3000 | Next.js application server |
| `sap-postgres` | postgres:16-alpine | 5432 (internal only) | PostgreSQL database |

**Key points:**
- PostgreSQL is **never exposed** outside the Docker network
- Nginx handles TLS with a self-signed certificate (auto-generated on first boot)
- The app runs as an unprivileged user (`nextjs:nodejs`, UID 1001)

\newpage

# 3. Database Schema

## 3.1 Entity Relationship Diagram

```
 Team 1───* Shift 1───* ShiftAssignment *───1 User
  |                                           |
  |  1                                    1   |
  +───* Pikett *──────────────────────────+   |
  |                                           |
  +───* User (members)                        |
  |                                           |
  +───? User (lead, unique)                   |

 RotationPattern  (standalone templates)
 Holiday          (standalone reference data)
 OutOfOfficeEvent (linked to User by email)
 AuditLog         (standalone audit trail)
```

## 3.2 Models

### User

| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| email | String (unique) | User email address |
| firstName / lastName | String | Full name |
| phone | String? | Phone number |
| location | String? | Swiss canton code (BE, ZH, VD) for holiday matching |
| role | String? | Job role |
| workPercent | Int (0-100) | Work percentage, default 100 |
| status | ACTIVE / INACTIVE | User status |
| rotationConfig | JSON? | Rotation pattern assignment |
| availability | JSON? | Weekly availability schedule (morning/afternoon per day) |
| teamId | String? | FK to Team |

### Team

| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| name | String | Team name |
| description | String? | Description |
| color | String | Hex color code |
| leadId | String? (unique) | FK to User (team lead) |

### Shift

| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| name | String | Shift name |
| startTime / endTime | String | Format "HH:MM" |
| daysOfWeek | Int[] | Active days (0=Sun, 1=Mon, ...) |
| membersRequired | Int | Number of people needed per shift |
| priority | LOW / MEDIUM / HIGH / CRITICAL | Shift priority |
| status | ACTIVE / INACTIVE / ARCHIVED | Shift status |
| color | String | Hex color code |
| senderMailbox | String | Shared mailbox email for calendar invites |
| includedUserIds / excludedUserIds | String[] | User allow/deny lists |
| teamId | String | FK to Team |

### Pikett (On-Call)

| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| name | String | Pikett name |
| startWeek / endWeek | String | ISO week format "2026-W09" |
| daysOfWeek | Int[] | Active days |
| is24_7 | Boolean | 24/7 on-call flag |
| teamId | String | FK to Team |
| userId | String? | FK to assigned User |
| includedUserIds / excludedUserIds | String[] | User allow/deny lists |

### ShiftAssignment

| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| date | DateTime | Assignment date |
| status | PENDING / ACCEPTED / REFUSED / CANCELLED | Response status |
| outlookEventId | String? | Microsoft Graph event ID |
| resent | Boolean | Was this assignment resent? |
| shiftId | String | FK to Shift |
| userId | String | FK to User |

**Unique constraint:** `[date, shiftId, userId]` - one assignment per user per shift per day.

### Holiday

| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| name | String | Holiday name |
| date | DateTime | Date |
| cantons | String[] | Applicable cantons (BE, ZH, VD, ALL) |
| type | FEDERAL / CANTONAL / CUSTOM | Holiday type |
| recurring | Boolean | Repeats every year |

### Other Models

- **RotationPattern**: Stores reusable multi-week rotation cycle templates
- **OutOfOfficeEvent**: Synced OOF events from Outlook, linked by `userEmail`
- **AuditLog**: Action audit trail with entity, action type, and JSON data

\newpage

# 4. Frontend Pages

## 4.1 Login Page (`/`)

**Purpose:** Authenticate the user via Azure AD SSO.

**How it works:**
- Displays a login button
- Calls MSAL `loginRedirect` to initiate the Azure AD OAuth flow
- On success, redirects to `/dashboard`
- Handles MFA automatically via Entra ID

**Connected to:** Microsoft Entra ID (Azure AD) - no internal API calls.

## 4.2 Dashboard (`/dashboard`)

**Purpose:** Operational overview of all shift assignments with statistics.

**Key features:**
- **KPI cards**: Total assignments, accepted, pending, refused counts
- **Date range filters**: 7d / 30d / 90d / 180d / All
- **Team filter**: Filter by team
- **Advanced filters**: By user, shift, status, specific date
- **Sortable table**: Paginated (10/page) with assignment details
- **Outlook Sync**: Button to sync accept/refuse responses from Outlook
- **Resend**: Reassign a shift to a different user (checks availability live)
- **Delete**: Remove an assignment and cancel the Outlook event
- **CSV Export**: Export assignments or user statistics
- **User Statistics tab**: Per-user acceptance rates

**API connections:**

| Endpoint | Purpose |
|----------|---------|
| GET `/api/shift-assignments` | Load assignments |
| GET `/api/shift-assignments/stats` | Load statistics |
| POST `/api/outlook/sync` | Sync Outlook responses |
| POST `/api/outlook/send-event` | Resend invitation |
| DELETE `/api/outlook/send-event` | Cancel Outlook event |
| PATCH `/api/shift-assignments/{id}` | Update assignment |
| DELETE `/api/shift-assignments/{id}` | Delete assignment |
| Graph `getSchedule` | Check OOF for resend |

## 4.3 Planner (`/planner`)

**Purpose:** The core scheduling engine. Auto-generates shift assignments and sends Outlook invitations.

**How the scheduling algorithm works:**

1. **Piketts (on-call)**: Assigns one user per week, rotating through eligible members
2. **Rotation patterns**: Users with assigned rotation patterns are placed first
3. **Regular shifts**: For each date x shift combination:
   - Checks 5 constraints in order:
     1. Public holiday (per user's canton)
     2. Working day check (per availability schedule)
     3. Already assigned to another shift today
     4. Out-of-Office / Busy in Outlook
     5. Consecutive shift check (avoid back-to-back days)
   - Picks the next available user from a weekly queue (deterministic shuffle)
   - Balances workload using assignment ratio

**Key features:**
- **Configuration panel**: Select shifts, piketts, date range
- **Monthly calendar view**: Color-coded assignment badges per day
- **Day detail dialog**: Click a day to see all assignments, available/unavailable users with reasons
- **Manual override**: Reassign any slot to a different user
- **Send invitations**: Bulk-send Outlook calendar events for all assignments
- **Settings**: Toggle algorithm rules (avoid consecutive, balance shifts, check calendars, etc.)

**API connections:**

| Endpoint | Purpose |
|----------|---------|
| GET `/api/shifts`, `/api/users`, `/api/teams`, `/api/piketts`, `/api/holidays` | Load reference data |
| GET `/api/shift-assignments?startDate=&endDate=` | Load existing assignments (calendar badges) |
| POST `/api/outlook/send-event` | Send Outlook invitation per assignment |
| POST `/api/shift-assignments` | Bulk-create DB records |
| Graph `getSchedule` | Batch OOF/busy check |

## 4.4 Users & Teams (`/users`)

**Purpose:** CRUD management for users and teams.

**Users management:**
- Grid view (avatar cards) or List view (sortable table)
- Search, filter by team/status, sort by name
- Create/Edit user: personal info, team assignment, availability schedule, rotation pattern
- Availability editor: full-time / part-time with per-day morning/afternoon toggle
- Work percentage auto-calculated from availability

**Teams management:**
- Create/Edit/Delete teams
- Assign team lead, color, description
- View member count and shift count

**API connections:** `GET/POST /api/users`, `PUT/DELETE /api/users/{id}`, `GET/POST /api/teams`, `PUT/DELETE /api/teams/{id}`

## 4.5 Shifts & Piketts (`/shifts`)

**Purpose:** CRUD management for shift definitions and on-call (pikett) definitions.

**Shift management:**
- Create/Edit/Delete shifts
- Set time range, active days, team, priority, color
- Sender mailbox (shared email for calendar invites)
- Member selector: include/exclude users from different teams
- Duplicate a shift with one click

**Pikett management:**
- Create/Edit/Delete pikett periods
- Set week range, active days, team, 24/7 flag
- Include/exclude users

**API connections:** `GET/POST /api/shifts`, `PUT/DELETE /api/shifts/{id}`, `GET/POST /api/piketts`, `PUT/DELETE /api/piketts/{id}`

## 4.6 Settings (`/settings`)

**Purpose:** System administration - planning rules, holidays, backups.

**3 tabs:**

1. **Planning Rules**: Toggle algorithm settings (avoid consecutive shifts, balance shifts, check OOF calendars, priority system, enable rotations). Saved to localStorage.

2. **Holidays**: Import Swiss public holidays (BE, ZH, VD cantons) per year. Create/edit/delete custom holidays. Used by the planner to skip holiday dates.

3. **Backup**: Create/download/restore/delete database backups. Upload a backup file for restore. Full DB wipe + restore with confirmation dialog.

**API connections:** `GET/POST /api/backup`, `GET /api/backup/download/{file}`, `DELETE /api/backup/{file}`, `POST /api/backup/restore`, `GET/POST /api/holidays`, `POST /api/holidays/import`

\newpage

# 5. API Reference

## 5.1 Authentication

All API endpoints (except `GET /api/cron/sync-outlook-responses`) require a valid Azure AD Bearer token:

```
Authorization: Bearer <access_token>
```

The token is validated server-side via JWKS (jose library) or Microsoft Graph fallback.

## 5.2 Endpoints Summary

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/teams` | GET, POST | List / create teams |
| `/api/teams/{id}` | GET, PUT, DELETE | Get / update / delete team |
| `/api/users` | GET, POST | List / create users |
| `/api/users/{id}` | GET, PUT, DELETE | Get / update / delete user |
| `/api/shifts` | GET, POST | List / create shifts |
| `/api/shifts/{id}` | GET, PUT, DELETE | Get / update / delete shift |
| `/api/piketts` | GET, POST | List / create piketts |
| `/api/piketts/{id}` | PUT, DELETE | Update / delete pikett |
| `/api/shift-assignments` | GET, POST | List (filtered) / bulk create assignments |
| `/api/shift-assignments/{id}` | GET, PUT, PATCH, DELETE | CRUD single assignment |
| `/api/shift-assignments/stats` | GET | Assignment statistics |
| `/api/holidays` | GET, POST | List / create holidays |
| `/api/holidays/{id}` | PUT, DELETE | Update / delete holiday |
| `/api/holidays/import` | POST | Import Swiss public holidays |
| `/api/rotation-patterns` | GET, POST | List / create patterns |
| `/api/rotation-patterns/{id}` | GET, PUT, DELETE | CRUD single pattern |
| `/api/outlook/send-event` | POST, DELETE | Create / cancel Outlook event |
| `/api/outlook/sync` | POST | Sync Outlook responses to DB |
| `/api/backup` | GET, POST | List backups / create backup |
| `/api/backup/{fileName}` | DELETE | Delete backup file |
| `/api/backup/download/{fileName}` | GET | Download backup file |
| `/api/backup/restore` | POST | Restore from backup |
| `/api/cron/sync-outlook-responses` | GET, POST | Cron job: auto-sync responses |

## 5.3 Rate Limiting

All endpoints include rate limiting via `lib/rateLimit.ts`:

| Type | Limit |
|------|-------|
| Standard (GET) | Based on client IP |
| Write (POST/PUT/DELETE) | Stricter limit |

\newpage

# 6. Deployment Guide

## 6.1 Prerequisites

- A Linux server (AlmaLinux 9.x recommended) with:
  - Docker 27.x
  - Docker Compose v2
  - Git
- A Microsoft Azure AD (Entra ID) tenant with an app registration
- Network access to `login.microsoftonline.com` and `graph.microsoft.com`

## 6.2 Azure AD (Entra ID) App Registration

### Step 1: Create the App Registration

1. Go to [Azure Portal](https://portal.azure.com) > **Microsoft Entra ID** > **App registrations** > **New registration**
2. Name: `Shift Auto Planner`
3. Supported account types: **Single tenant** (this organization only)
4. Redirect URI: **Single-page application (SPA)** > `https://<YOUR_DOMAIN>:8443`
5. Click **Register**

### Step 2: Configure API Permissions

Go to **API permissions** > **Add a permission** > **Microsoft Graph** > **Delegated permissions**:

| Permission | Purpose |
|------------|---------|
| `User.Read` | Read user profile |
| `Calendars.Read` | Read calendars for OOF check |
| `Calendars.ReadWrite` | Create/cancel calendar events |
| `Calendars.ReadWrite.Shared` | Access shared mailbox calendars |

Click **Grant admin consent** for your organization.

### Step 3: Note the Values

From the **Overview** page, copy:
- **Application (client) ID** → `AZURE_AD_CLIENT_ID` / `NEXT_PUBLIC_AZURE_AD_CLIENT_ID`
- **Directory (tenant) ID** → `AZURE_AD_TENANT_ID` / `NEXT_PUBLIC_AZURE_AD_TENANT_ID`

From **Certificates & secrets** > **New client secret**:
- Copy the secret value → `AZURE_AD_CLIENT_SECRET`

### Step 4: Configure Redirect URIs

Go to **Authentication** > **Single-page application** > Add:
- `https://<YOUR_DOMAIN>:8443`
- `http://localhost:3000` (for development)

Enable: **Access tokens** and **ID tokens** under "Implicit grant and hybrid flows".

## 6.3 Server Setup

### Step 1: Clone the Repository

```bash
git clone https://gitlab.bnc.ch/bnc_internal_operations/SAP_Almalinux.git
cd SAP_Almalinux
```

### Step 2: Create the .env File

```bash
cp .env.example .env
nano .env
```

Fill in all values:

```env
# Database (internal Docker network - do not change host/port)
DATABASE_URL="postgresql://sa_sap:YOUR_DB_PASSWORD@sap-postgres:5432/shiftautoplanner?schema=public"

# Azure AD - Server-side
AZURE_AD_CLIENT_ID=<your-client-id>
AZURE_AD_CLIENT_SECRET=<your-client-secret>
AZURE_AD_TENANT_ID=<your-tenant-id>

# Azure AD - Client-side (baked into build)
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=<your-client-id>
NEXT_PUBLIC_AZURE_AD_TENANT_ID=<your-tenant-id>
NEXT_PUBLIC_AZURE_AD_REDIRECT_URI=https://<YOUR_DOMAIN>:8443

# Application
NEXT_PUBLIC_URL=https://<YOUR_DOMAIN>:8443

# Cron security
CRON_SECRET=<generate-a-strong-random-string>
NEXT_PUBLIC_CRON_SECRET=<same-value-as-above>

# Optional: Microsoft Graph refresh token (for server-side cron sync)
MICROSOFT_GRAPH_REFRESH_TOKEN=
```

### Step 3: Update Nginx Configuration

Edit `nginx/conf.d/sap.conf` and replace `sap.lab.sr.bnc.ch` with your domain.

### Step 4: Build and Start

```bash
docker compose build --no-cache app
docker compose up -d
```

### Step 5: Verify

```bash
# Check all 3 containers are running
docker ps

# Check app logs
docker logs sap-app

# Test the app
curl -k https://localhost:8443
```

The app should be accessible at `https://<YOUR_DOMAIN>:8443`.

## 6.4 Updating the Application

```bash
cd /path/to/SAP_Almalinux
git pull
docker compose build --no-cache app
docker compose up -d app
```

PostgreSQL and Nginx are not rebuilt - only the app container is replaced.

## 6.5 Updating Dependencies (npm packages)

All dependencies are defined in `package.json`. To update them:

### Step 1: Check for outdated packages (on your development machine)

```bash
npm outdated
```

This shows a table of current vs. latest versions.

### Step 2: Update minor/patch versions (safe)

```bash
npm update
```

This updates packages within the ranges defined in `package.json` (e.g. `^16.1.6` allows 16.x.x).

### Step 3: Update major versions (breaking changes - test carefully)

```bash
# Update a specific package to latest major
npm install next@latest

# Or update all to latest (review changes carefully)
npx npm-check-updates -u
npm install
```

### Step 4: Verify the build

```bash
npm run build
```

### Step 5: Test in Docker

```bash
docker compose build --no-cache app
docker compose up -d app
# Verify the app works at http://localhost:3000
```

### Step 6: Commit and deploy

```bash
git add package.json package-lock.json
git commit -m "Update dependencies"
git push
```

### Key packages and how to update them

| Package | Current | Update command | Impact |
|---------|---------|----------------|--------|
| **Next.js** | 16.1.6 | `npm install next@latest eslint-config-next@latest` | High - test all pages |
| **React** | 19.2.4 | `npm install react@latest react-dom@latest` | High - test all UI |
| **Prisma** | 7.4.1 | `npm install prisma@latest @prisma/client@latest @prisma/adapter-pg@latest` then `npx prisma generate` | High - test all DB operations |
| **MSAL** | 4.29 / 3.0.27 | `npm install @azure/msal-browser@latest @azure/msal-react@latest` | Medium - test login flow |
| **next-intl** | 4.8.3 | `npm install next-intl@latest` | Medium - test i18n routing |
| **Tailwind CSS** | 4.2.1 | `npm install tailwindcss@latest @tailwindcss/postcss@latest` | Low - visual check |
| **Radix UI** | Various | `npm install @radix-ui/react-dialog@latest @radix-ui/react-select@latest ...` | Low - test dialogs/dropdowns |
| **Zod** | 4.3.6 | `npm install zod@latest` | Low - test form validation |
| **TypeScript** | 5.x | `npm install typescript@latest @types/node@latest @types/react@latest` | Low - build check |

### Updating Node.js version (Docker container)

The app runs on `node:20-alpine` inside Docker. To update Node.js:

1. Edit `Dockerfile` - change the base image on all 3 stages:
   ```dockerfile
   FROM node:22-alpine AS deps   # Change 20 to 22 (or any LTS version)
   FROM node:22-alpine AS builder
   FROM node:22-alpine AS runner
   ```
2. Rebuild: `docker compose build --no-cache app`
3. Test thoroughly before deploying

**Recommendation:** Stay on Node.js LTS versions (even numbers: 20, 22, 24...).

### Updating PostgreSQL version

1. **Create a backup first** via the Settings page or CLI
2. Edit `docker-compose.yml`:
   ```yaml
   sap-postgres:
     image: postgres:17-alpine  # Change from 16 to 17
   ```
3. Stop and remove the old container + volume:
   ```bash
   docker compose down
   docker volume rm sap_almalinux_postgres-data
   ```
4. Start fresh and restore:
   ```bash
   docker compose up -d
   # Restore via the Settings page (upload your backup file)
   ```

**Warning:** Changing the PostgreSQL major version requires deleting the data volume. Always backup first.

### Updating Nginx

Edit `docker-compose.yml`:
```yaml
nginx:
  image: nginx:1.27   # Change from nginx:stable to a specific version
```
Then: `docker compose pull nginx && docker compose up -d nginx`

\newpage

# 7. CI/CD Pipeline (GitLab)

## 7.1 Pipeline Overview

```
git push main
    |
    v
+-------------------+     +-------------------+
|  Stage: build     |     |  Stage: deploy    |
|                   |     |                   |
|  - Build Docker   +---->+  - SSH to server  |
|  - Push to        |     |  - Pull image     |
|    registry       |     |  - Restart app    |
|                   |     |  - Health check   |
+-------------------+     +-------------------+
```

## 7.2 Required GitLab CI/CD Variables

Go to **Settings > CI/CD > Variables** on your GitLab project:

| Variable | Type | Masked | Value |
|----------|------|--------|-------|
| `SSH_PRIVATE_KEY` | Variable | Yes | SSH private key for production server |
| `SSH_KNOWN_HOSTS` | Variable | No | Output of `ssh-keyscan <SERVER_IP>` |
| `SSH_USER` | Variable | No | SSH username on production server |
| `SSH_HOST` | Variable | No | IP or hostname of production server |
| `DEPLOY_PATH` | Variable | No | Path to project on server (e.g. `/opt/SAP_Almalinux`) |
| `NEXT_PUBLIC_AZURE_AD_CLIENT_ID` | Variable | No | Azure AD Client ID |
| `NEXT_PUBLIC_AZURE_AD_TENANT_ID` | Variable | No | Azure AD Tenant ID |
| `NEXT_PUBLIC_AZURE_AD_REDIRECT_URI` | Variable | No | OAuth redirect URI |
| `NEXT_PUBLIC_CRON_SECRET` | Variable | Yes | Cron secret |

## 7.3 GitLab Runner Setup

If no shared runner is available, install one on any machine with Docker:

```bash
# Install GitLab Runner (AlmaLinux/RHEL)
curl -L https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.rpm.sh | sudo bash
sudo dnf install gitlab-runner

# Register the runner
sudo gitlab-runner register \
  --url https://gitlab.bnc.ch \
  --token <RUNNER_TOKEN> \
  --executor docker \
  --docker-image docker:27 \
  --docker-privileged
```

Get the runner token from **Settings > CI/CD > Runners** in your GitLab project.

\newpage

# 8. Environment Variables Reference

| Variable | Required | Build-time | Description |
|----------|----------|------------|-------------|
| `DATABASE_URL` | Yes | No | PostgreSQL connection string |
| `AZURE_AD_CLIENT_ID` | Yes | No | Azure AD app client ID (server) |
| `AZURE_AD_CLIENT_SECRET` | Yes | No | Azure AD app secret (server) |
| `AZURE_AD_TENANT_ID` | Yes | No | Azure AD tenant ID (server) |
| `NEXT_PUBLIC_AZURE_AD_CLIENT_ID` | Yes | **Yes** | Azure AD client ID (browser) |
| `NEXT_PUBLIC_AZURE_AD_TENANT_ID` | Yes | **Yes** | Azure AD tenant ID (browser) |
| `NEXT_PUBLIC_AZURE_AD_REDIRECT_URI` | Yes | **Yes** | OAuth redirect URI (browser) |
| `NEXT_PUBLIC_URL` | Yes | No | Public app URL |
| `CRON_SECRET` | Yes | No | Secret for cron job auth |
| `NEXT_PUBLIC_CRON_SECRET` | Yes | **Yes** | Cron secret (browser) |
| `MICROSOFT_GRAPH_REFRESH_TOKEN` | No | No | Optional Graph refresh token |

**Build-time = Yes** means the variable is baked into the Next.js JavaScript bundle during `docker build`. Changing it requires a rebuild.

\newpage

# 9. Backup and Restore

## 9.1 Via Web UI

Go to **Settings > Backup** tab:
- **Create Backup**: Click the button to dump all database tables to a JSON file
- **Download**: Download any backup file
- **Restore**: Select a backup and confirm to wipe + restore the entire database
- **Upload**: Upload a backup JSON file from your computer

## 9.2 Via Command Line

```bash
# Create a backup
docker exec sap-app npx tsx scripts/backup.ts

# Restore from latest backup
docker exec sap-app npx tsx scripts/restore.ts

# Restore from a specific file
docker exec sap-app npx tsx scripts/restore.ts backup_2026-02-24_1234567890.json
```

Backup files are stored in `./backups/` (bind-mounted from host).

\newpage

# 10. Project Structure

```
SAP_Almalinux/
|-- app/
|   |-- [locale]/           # i18n pages (en, fr, de)
|   |   |-- page.tsx         # Login page
|   |   |-- dashboard/       # Dashboard
|   |   |-- planner/         # Planner
|   |   |-- users/           # Users & Teams
|   |   |-- shifts/          # Shifts & Piketts
|   |   |-- settings/        # Settings, Holidays, Backup
|   |   +-- layout.tsx       # Auth + i18n providers
|   +-- api/                 # REST API routes
|       |-- teams/
|       |-- users/
|       |-- shifts/
|       |-- piketts/
|       |-- shift-assignments/
|       |-- holidays/
|       |-- rotation-patterns/
|       |-- outlook/
|       |-- backup/
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
|   |-- AuthContext.tsx       # Authentication context
|   +-- RotationPatternsContext.tsx
|-- prisma/
|   |-- schema.prisma        # Database schema
|   +-- migrations/          # Prisma migrations
|-- messages/                # i18n translations
|   |-- en.json
|   |-- fr.json
|   +-- de.json
|-- i18n/                    # i18n config
|-- nginx/                   # Nginx config
|-- scripts/                 # Backup/restore scripts
|-- docker-compose.yml
|-- Dockerfile
|-- docker-entrypoint.sh
|-- prisma.config.ts
+-- .gitlab-ci.yml
```

\newpage

# 11. Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| 500 errors on all API routes | SSL connection issue with Prisma 7 | Ensure `sslmode=prefer` is not in DATABASE_URL, or use the code fix in `lib/prisma.ts` |
| Login redirect fails | Wrong redirect URI in Azure AD | Verify `NEXT_PUBLIC_AZURE_AD_REDIRECT_URI` matches Azure Portal |
| Calendar events not sent | Missing Graph permissions | Ensure `Calendars.ReadWrite` + `Calendars.ReadWrite.Shared` are consented |
| Container exits immediately | Database not ready | Check `docker logs sap-app` - entrypoint retries 30 times |
| Build fails (Turbopack) | Custom webpack config incompatible | Build uses `--webpack` flag (set in package.json) |
| Prisma migration fails | First deployment | Entrypoint falls back to `prisma db push` automatically |
| Backup restore fails | Empty backup list | Upload a backup file via the Settings page |

## Useful Commands

```bash
# View all container logs
docker compose logs -f

# View app logs only
docker logs -f sap-app

# Access PostgreSQL directly
docker exec -it sap-postgres psql -U sa_sap -d shiftautoplanner

# Check database tables
docker exec -it sap-postgres psql -U sa_sap -d shiftautoplanner -c "\dt"

# Restart only the app
docker compose restart app

# Full rebuild
docker compose build --no-cache app && docker compose up -d app
```
