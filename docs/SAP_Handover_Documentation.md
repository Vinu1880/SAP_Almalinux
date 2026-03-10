---
title: "Shift Auto Planner (SAP) - Technical Handover Documentation"
subtitle: "BNC / Axians - Internal Operations"
date: "March 2026"
author: "BNC Internal Operations"
---

\newpage

# 1. Project Overview

## 1.1 What is Shift Auto Planner?

Shift Auto Planner (SAP) is an internal web application that **automates the scheduling of on-call shifts (pikett) and regular work shifts** for BNC/Axians teams. It integrates with Microsoft Outlook to send calendar invitations and track responses (accepted/refused/pending).

**Key capabilities:**

- Automatic shift assignment respecting constraints (holidays, OOF, availability, rotations)
- User rules system (week parity, double-shift linking, max load limiting)
- Microsoft Outlook calendar integration (send invitations, sync responses)
- Multi-team, multi-shift management
- On-call (pikett) scheduling with weekly rotation
- Rotation patterns with multi-week cycles
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

# 2. How to Use — Getting Started Guide

This section explains **how to set up SAP from scratch** once the application is deployed and running. Follow these steps in order — some entities depend on others.

## 2.1 Step 1: Log In

1. Open your browser and go to `https://<YOUR_DOMAIN>:8443`
2. Click **"Sign in with Azure AD"**
3. Authenticate with your Vinci Energies / Axians Microsoft account (MFA required)
4. You are redirected to the Dashboard

## 2.2 Step 2: Import Holidays

**Go to:** Settings > Holidays tab

Holidays must be imported **before** generating any plan, otherwise the planner cannot respect public holidays.

1. Select the year (e.g., 2026)
2. Click **"Import standards"** to import Swiss public holidays for cantons BE, ZH, VD
3. You can also:
   - **Import CSV**: Upload a CSV file with `date` and `name` columns
   - **Add custom holidays**: Click "Add holiday", fill in name, date, cantons, and type (Federal / Cantonal / Custom)
4. Toggle **"Recurring annually"** for holidays that repeat every year

**Why cantons matter:** Each user has a `location` field (canton). The planner only skips holidays that apply to the user's canton. A user in Berne won't be blocked by a Zurich-only holiday.

<!-- [Screenshot: Settings > Holidays tab with imported holidays] -->

## 2.3 Step 3: Create Teams

**Go to:** Users > Teams tab

Teams are required before creating users (every user belongs to a team).

1. Click **"Create Team"**
2. Fill in:
   - **Name**: e.g., "SEC", "CDC", "DM"
   - **Description**: Optional
   - **Color**: Pick a color (used in the planner calendar)
3. Click **Save**

You can assign a **Team Lead** later once users are created.

<!-- [Screenshot: Team creation dialog] -->

## 2.4 Step 4: Create Users

**Go to:** Users > Users tab

1. Click **"Create user"**
2. Fill in required fields:
   - **First name** and **Last name**
   - **Email**: Must be a valid Microsoft email (used for Outlook integration)
   - **Team**: Select from the teams you created
   - **Location (canton)**: BE, ZH, or VD — determines which holidays apply
3. Optional fields:
   - **Phone**, **Role**, **Notes**
   - **Contract type**: Full-time (100%) or Part-time (custom availability)
4. **Availability schedule** (for part-time users):
   - Toggle morning/afternoon for each day of the week
   - Work percentage is auto-calculated
5. Click **Save**

**Important:** A user **must** have an email address matching their Microsoft account for Outlook calendar integration to work.

<!-- [Screenshot: User creation form with availability editor] -->

## 2.5 Step 5: Create Shifts

**Go to:** Shifts > Shifts tab

1. Click **"Create Shift"**
2. Fill in:
   - **Name**: e.g., "Morning Support", "Afternoon Helpdesk"
   - **Team**: The team this shift belongs to
   - **Start time / End time**: e.g., 07:30 - 12:00
   - **Days of week**: Check the days this shift is active (Mon-Fri by default)
   - **Members required**: How many people are needed per day (usually 1)
   - **Priority**: LOW / MEDIUM / HIGH / CRITICAL
   - **Color**: Used in the planner calendar
   - **Shared Mailbox**: The email address used to send Outlook invitations (e.g., `support-sec@company.com`)
3. **Eligible personnel**: By default, all users in the selected team are eligible. You can:
   - **Exclude** specific team members
   - **Include** users from other teams
4. Click **Save**

<!-- [Screenshot: Shift creation form with member selector] -->

## 2.6 Step 6: Create Piketts (On-Call)

**Go to:** Shifts > Piketts tab

Piketts are weekly on-call assignments (typically one person per week).

1. Click **"Create Pikett"**
2. Fill in:
   - **Name**: e.g., "Pikett SEC", "Pikett DM"
   - **Team**: The team this pikett belongs to
   - **Start week / End week**: ISO week format (e.g., "2026-W09")
   - **Days of week**: Active days
   - **24/7**: Toggle for continuous on-call
   - **Color**: Used in the planner
3. **Eligible personnel**: Same as shifts — include/exclude users
4. Click **Save**

<!-- [Screenshot: Pikett creation form] -->

## 2.7 Step 7: Set Up Rotation Patterns (Optional)

**Go to:** Users > Users tab > Edit a user > Automatic rotation section

Rotation patterns define a repeating multi-week cycle for a user.

**Step 7a: Create a pattern:**

1. Click **"Create Rotation Pattern"**
2. Fill in:
   - **Pattern name**: e.g., "Rotation Madlen"
   - **Cycle duration**: Number of weeks in the cycle (1-6 weeks)
3. **Select a user** to load their available shifts
4. **Configure the week grid**: For each week in the cycle, assign a shift/pikett to each day
   - Days where the user is not available are grayed out
   - Piketts are shown with "(Pikett)" label
5. Click **Create Pattern**

**Step 7b: Assign pattern to a user:**

1. Edit the user
2. Enable **"Automatic rotation"**
3. Select the pattern from the dropdown
4. Save the user

<!-- [Screenshot: Rotation pattern grid with week configuration] -->

## 2.8 Step 8: Configure User Rules (Optional)

**Go to:** Users > Users tab > Edit a user > Rules section

Rules add constraints to the automatic planner. Three types are available:

### Week Parity (WEEK_PARITY)

Restricts a user to work only on **odd** or **even** ISO weeks.

- **Use case**: Two users alternate pikett duty — one on odd weeks, one on even weeks
- **Config**: Select "Odd weeks" or "Even weeks"
- **Limit**: One WEEK_PARITY rule per user

### Double-Shift (DOUBLE_SHIFT)

When a user is assigned to a **trigger shift**, they are automatically also assigned to a **linked shift** on the same date.

- **Use case**: When Jean-Marc is on DM pikett, he should also be on Devops pikett
- **Config**: Select trigger shift/pikett and linked shift/pikett
- **Limit**: One DOUBLE_SHIFT rule per trigger shift
- **Constraint**: Trigger and linked shift must be different
- **Chaining**: Supports chains (A→B and B→C will result in A→B→C)
- **Pikett conflict**: If two users' DOUBLE_SHIFT rules target the same pikett on the same date, the first processed wins

### Max Load (MAX_LOAD)

Limits the maximum percentage of assignments a user can receive for a specific shift.

- **Use case**: A part-time user should not be assigned more than 50% of a shift
- **Config**: Select shift and set max percentage (1-100%)
- **Limit**: One MAX_LOAD rule per shift per user
- **Calculation**: `max assignments = ceil(active dates × percentage / 100)`, minimum 1

<!-- [Screenshot: Rules section in user edit dialog showing all 3 rule types] -->

## 2.9 Step 9: Generate a Plan

**Go to:** Planner

1. **Configure the period**: Set start and end dates
2. **Select shifts**: Check the shifts you want to schedule
3. **Select piketts**: Check the piketts you want to schedule
4. **Adjust settings** (gear icon):
   - Enable rotations
   - Fair distribution
   - Check Outlook calendars
   - Priority system
5. Click **"Preview"** to generate the plan
6. **Review the calendar**: Each day shows color-coded assignment badges
7. **Click a day** to see details: assigned users, available users, unavailable users with reasons
8. **Manual override**: In the day detail, click on an available user to reassign a shift
9. Once satisfied, click **"Send Invitations"** to create Outlook calendar events

<!-- [Screenshot: Planner calendar with assignment badges and day detail dialog] -->

## 2.10 Step 10: Monitor on the Dashboard

**Go to:** Dashboard

After sending invitations:

1. **KPI cards** show totals: assigned, accepted, pending, refused
2. **Click "Sync"** to fetch latest responses from Outlook
3. **Resend**: If someone refuses, click "Resend" to reassign to another user
4. **Delete**: Remove an assignment and cancel the Outlook event
5. **Export CSV**: Download assignments or user statistics

<!-- [Screenshot: Dashboard with KPI cards and assignment table] -->

\newpage

# 3. Architecture

## 3.1 Authentication Flow

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

## 3.2 Data Flow — Outlook Integration

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

When the planner generates a plan with "Check calendars" enabled:

1. Fetches OOF/busy status via Microsoft Graph `POST /me/calendar/getSchedule`
2. Users are processed in **batches of 20** (Graph API limit)
3. Timezone: `Europe/Zurich`
4. Availability is checked in **24-hour blocks** (full-day granularity)
5. Both `oof` (Out of Office) and `busy` statuses are treated as unavailable
6. **End date correction**: Graph returns exclusive end dates (e.g., OOF until March 1 = end March 2T00:00). SAP subtracts 1 day to get the real last day.
7. **Fallback**: If `getSchedule` fails, falls back to reading individual calendars

**Step 2 — Send shift invitations:**

After generating and reviewing the plan, clicking "Send Invitations":

1. Creates Outlook calendar events via `POST /users/{mailbox}/calendar/events`
2. Uses the shift's **shared mailbox** (senderMailbox field) as the organizer
3. The assigned user receives a calendar invitation they can accept or refuse
4. The Outlook event ID is stored in the `ShiftAssignment` record

**Step 3 — Sync responses:**

Two methods to sync responses:

- **Manual sync**: Click "Sync" button on the Dashboard
- **Automated cron**: `GET /api/cron/sync-outlook-responses` (secured by CRON_SECRET)

The sync process:
1. Finds all PENDING or TENTATIVE assignments with an Outlook event ID
2. Fetches the Outlook event and reads the attendee's response
3. Maps responses: `accepted` → ACCEPTED, `tentativelyaccepted` → TENTATIVE, `declined` → REFUSED
4. If REFUSED: Attempts to cancel the Outlook event (sends notification to user)
5. Updates the assignment status in the database

## 3.3 Infrastructure

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

# 4. Scheduling Algorithm — How the Planner Works

The planner generates shift assignments in a specific order. Understanding this order is essential for debugging unexpected assignments.

## 4.1 Overview — Processing Order

```
+-------------------+     +--------------------+     +---------------------+
|                   |     |                    |     |                     |
|  PART 1           +---->+  PART 2.1          +---->+  PART 2.2           |
|  Pikett           |     |  Rotation          |     |  Fair Distribution  |
|  (weekly rotation)|     |  Patterns          |     |  (remaining slots)  |
|                   |     |                    |     |                     |
+-------------------+     +--------------------+     +----------+----------+
                                                                |
                                                                v
                                                     +----------+----------+
                                                     |                     |
                                                     |  POST-PROCESSING    |
                                                     |  DOUBLE_SHIFT       |
                                                     |  (auto-link)        |
                                                     |                     |
                                                     +---------------------+
```

## 4.2 PART 1 — Pikett Assignment (Weekly Rotation)

**Purpose:** Assign one user per pikett per week, rotating through eligible members.

**Process:**

1. Group all dates by ISO week number
2. For each week, find the next available user:

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
      If (assigned user exists):
        CHECK: Public holiday → mark unavailable
        CHECK: OOF on this specific day → mark unavailable
        If all pass → create assignment
      Else:
        Create unassigned entry (no eligible user)

    Move to next user for following weeks
```

**Key behavior:** If no user passes all checks, the pikett slot is left **unassigned** (no forced assignment). This respects WEEK_PARITY constraints.

## 4.3 PART 2.1 — Rotation Pattern Assignment (2-Pass System)

**Purpose:** Place users who have an assigned rotation pattern on their designated shifts.

**Condition:** Only runs if "Enable rotations" setting is ON.

The rotation engine uses a **2-pass system** to maximize pattern adherence:

**Pass 1 — Strict placement:** Assigns rotation shifts only where the slot is completely free (no conflicts with existing assignments, no constraint violations). This pass never displaces other assignments.

**Pass 2 — Gap filling:** Reviews any rotation days that were skipped in Pass 1 and attempts to place them with relaxed constraints, filling gaps left by OOF or other temporary blockers.

**Process (per pass):**

```
For each date:
  For each user with a rotation pattern:
    Get the shift assigned for this date from the pattern
    (uses ISO week number to determine which week of the cycle)

    CHECK: Shift is in the selected shifts/piketts for this plan
    CHECK: Not already assigned (e.g., by PART 1)
    CHECK: Not on public holiday
    CHECK: Not OOF (if calendar check enabled)
    CHECK: WEEK_PARITY rule matches
    CHECK: User is eligible for this shift
    CHECK: minConsecutiveDays respected (shift must allow enough consecutive days)

    If all pass → create assignment (marked as rotation assignment)
```

**Rotation continuity:** Uses ISO week numbers (not the start date of the planning period) to ensure rotations stay in sync when generating in separate 3-4 month batches. Week 15 is always the same cycle position regardless of when you generate.

## 4.4 PART 2.2 — Fair Distribution (Regular Shifts)

**Purpose:** Fill remaining shift slots fairly among eligible users.

**Pre-processing:**
- If Priority System is enabled: sort shifts by member count (ascending) — shifts with fewer eligible users are processed first
- Create weekly queues: per (week, shift) combination, create a shuffled queue of eligible users

**Process (for each date × shift combination):**

```
PRIORITY 1: PUBLIC HOLIDAYS
  → Is the user on a public holiday? (checked per canton)
  → If yes → unavailable (reason: holiday name)

PRIORITY 2: WORK AVAILABILITY
  → Does the user work on this day/time? (from availability schedule)
  → Checks morning/afternoon based on shift time range
  → If no → unavailable (reason: "Not working today")

PRIORITY 2.5: WEEK PARITY RULE
  → Does the user have a WEEK_PARITY rule?
  → If ISO week parity doesn't match → unavailable (reason: "Week parity (odd/even)")

PRIORITY 3: ALREADY ASSIGNED TODAY
  → Is the user already assigned to another shift today?
  → If yes → unavailable (reason: "Already assigned today")

PRIORITY 4: OUTLOOK CALENDAR (OOF)
  → Is the user Out of Office or Busy? (only if "Check calendars" enabled)
  → If yes → unavailable (reason: "Out of Office")

PRIORITY 5: MINIMUM CONSECUTIVE DAYS
  → Does the shift have minConsecutiveDays > 1?
  → Would assigning this user create a block shorter than the minimum?
  → If yes → unavailable (reason: "Min consecutive days not met")

PRIORITY 6: MAX LOAD RULE
  → Does the user have a MAX_LOAD rule for this shift?
  → Calculate: max_assignments = ceil(active_dates × max_percentage / 100)
  → If current count >= max → unavailable (reason: "Max load reached (X%)")
```

**Selection among available users:**

```
PASS 1: Round-robin (preferred)
  → Pick next user in the weekly queue
  → Skip if already assigned this shift this week
  → Ensures variety within a week

PASS 2: Ratio-based balance (fallback)
  → If all available users already assigned this week
  → Calculate ratio: assignments / available_days
  → Select user with lowest ratio (least loaded)
```

## 4.5 Post-Processing — DOUBLE_SHIFT

**Purpose:** After all assignments are made, automatically add linked shift assignments based on DOUBLE_SHIFT rules.

**Process (up to 5 passes for chaining support):**

```
For each pass (max 5):
  For each assignment from previous pass:
    For each assigned user:
      Find DOUBLE_SHIFT rules where triggerShiftId matches this assignment's shiftId

      For each triggered rule:
        linkedShiftId = rule.config.linkedShiftId

        CHECK: Not already assigned to linked shift on this date
        CHECK: If linked is a pikett → only 1 user per pikett per date (first wins)
        CHECK: MAX_LOAD rule for linked shift → skip if limit reached

        If all pass → create separate assignment entry

  If no new assignments in this pass → stop
  Otherwise → new assignments become source for next pass
```

**Chaining example:** If User A has SEC→CDC and CDC→Devops, Pass 1 adds CDC, Pass 2 adds Devops.

**Pikett conflict example:** Jean-Marc has DM→Devops, Jeremy has SEC→Devops. If both are assigned on the same week, the first processed user gets Devops. The second is skipped for that date.

\newpage

# 5. Database Schema

## 5.1 Entity Relationship Diagram

```
 Team 1───* Shift 1───* ShiftAssignment *───1 User
  |                                           |
  |  1                                    1   |
  +───* Pikett *──────────────────────────+   |
  |                                           |
  +───* User (members)                        |
  |                                           |
  +───? User (lead, unique)                   |
  |                                           |
  |                                    1      |
  +                                User ──* UserRule
                                              |
                                              +--> type: WEEK_PARITY | DOUBLE_SHIFT | MAX_LOAD
                                              +--> config: JSON (type-specific)
                                              +--> enabled: Boolean

 RotationPattern  (standalone templates, linked to User via rotationConfig JSON)
 Holiday          (standalone reference data, matched by canton)
 OutOfOfficeEvent (linked to User by email)
 AuditLog         (standalone audit trail)
```

## 5.2 Models

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
| rotationConfig | JSON? | Rotation pattern assignment (`{ patternId }`) |
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
| minConsecutiveDays | Int (default 1) | Minimum consecutive days a user must be assigned to this shift |
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

### UserRule

| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| userId | String | FK to User (cascade delete) |
| type | WEEK_PARITY / DOUBLE_SHIFT / MAX_LOAD | Rule type |
| config | JSON | Type-specific configuration (see below) |
| enabled | Boolean | Toggle on/off without deleting |

**Config per type:**

| Type | Config JSON | Example |
|------|-------------|---------|
| WEEK_PARITY | `{ "parity": "odd" \| "even" }` | `{ "parity": "odd" }` |
| DOUBLE_SHIFT | `{ "triggerShiftId": "...", "linkedShiftId": "..." }` | `{ "triggerShiftId": "clx1...", "linkedShiftId": "clx2..." }` |
| MAX_LOAD | `{ "shiftId": "...", "maxPercentage": 50 }` | `{ "shiftId": "clx3...", "maxPercentage": 50 }` |

**Validation rules:**
- WEEK_PARITY: Only 1 per user
- DOUBLE_SHIFT: Only 1 per trigger shift; trigger ≠ linked
- MAX_LOAD: Only 1 per shift per user; percentage 1-100%

**Orphan cleanup:** When a shift or pikett is deleted, all UserRules referencing it in their config (triggerShiftId, linkedShiftId, shiftId) are automatically deleted.

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

- **RotationPattern**: Stores reusable multi-week rotation cycle templates (name, cycleLength, weeks JSON grid, userShifts list)
- **OutOfOfficeEvent**: Synced OOF events from Outlook, linked by `userEmail`
- **AuditLog**: Action audit trail with entity, action type, and JSON data

\newpage

# 6. Frontend Pages

## 6.1 Login Page (`/`)

**Purpose:** Authenticate the user via Azure AD SSO.

**How it works:**
- Displays a login button
- Calls MSAL `loginRedirect` to initiate the Azure AD OAuth flow
- On success, redirects to `/dashboard`
- Handles MFA automatically via Entra ID

**Connected to:** Microsoft Entra ID (Azure AD) - no internal API calls.

## 6.2 Dashboard (`/dashboard`)

**Purpose:** Operational overview of all shift assignments with statistics.

**Key features:**
- **KPI cards**: Total assignments, accepted, pending, refused counts
- **Date range filters**: 7d / 30d / 90d / 180d / All
- **Team filter**: Filter by team
- **Advanced filters**: By user, shift, status, specific date
- **Calendar view**: Monthly calendar with assignment badges
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

## 6.3 Planner (`/planner`)

**Purpose:** The core scheduling engine. Auto-generates shift assignments and sends Outlook invitations.

**How the scheduling algorithm works** (see Chapter 4 for full details):

1. **PART 1 — Piketts**: Assigns one user per week, rotating through eligible members
2. **PART 2.1 — Rotations**: Users with assigned rotation patterns are placed first
3. **PART 2.2 — Fair distribution**: Remaining slots filled with priority-based constraint checking
4. **Post-processing — DOUBLE_SHIFT**: Automatic linked shift assignments added

**For each user, 6 constraints are checked in order:**
1. Public holiday (per user's canton)
2. Working day check (per availability schedule)
3. Week parity rule (WEEK_PARITY)
4. Already assigned to another shift today
5. Out-of-Office / Busy in Outlook
6. Minimum consecutive days (per-shift setting) + MAX_LOAD rule

**Key features:**
- **Configuration panel**: Select shifts, piketts, date range
- **Settings panel** (gear icon): Toggle algorithm rules
- **Monthly calendar view**: Color-coded assignment badges per day
- **Day detail dialog**: Click a day to see all assignments, available/unavailable users with reasons
- **Manual override**: Reassign any slot to a different user
- **Send invitations**: Bulk-send Outlook calendar events for all assignments (sent in parallel batches of 5 with a real-time progress dialog)

**Planning Settings:**

| Setting | Default | Effect |
|---------|---------|--------|
| Enable rotations | ON | Uses rotation patterns for assignment (PART 2.1) |
| Fair distribution | ON | Balances workload using assignment ratio |
| Check calendars | ON | Checks Outlook OOF/busy status |
| Priority system | ON | Processes shifts with fewer eligible users first |

**API connections:**

| Endpoint | Purpose |
|----------|---------|
| GET `/api/shifts`, `/api/users`, `/api/teams`, `/api/piketts`, `/api/holidays` | Load reference data |
| GET `/api/shift-assignments?startDate=&endDate=` | Load existing assignments |
| GET `/api/users/{id}/rules` | Load user rules (included in user data) |
| POST `/api/outlook/send-event` | Send Outlook invitation per assignment |
| POST `/api/shift-assignments` | Bulk-create DB records |
| Graph `getSchedule` | Batch OOF/busy check |

## 6.4 Users & Teams (`/users`)

**Purpose:** CRUD management for users, teams, rotation patterns, and user rules.

**Users management:**
- Grid view (avatar cards) or List view (sortable table)
- Search, filter by team/status, sort by name
- Create/Edit user: personal info, team assignment, availability schedule
- Availability editor: full-time / part-time with per-day morning/afternoon toggle
- Work percentage auto-calculated from availability
- **Rotation pattern**: Assign a rotation pattern to a user
- **Rules**: Add, edit, toggle, delete user rules (WEEK_PARITY, DOUBLE_SHIFT, MAX_LOAD)

**Teams management:**
- Create/Edit/Delete teams
- Assign team lead, color, description
- View member count and shift count

**Rotation patterns management:**
- Create/Edit/Delete rotation patterns
- Pattern grid: multi-week cycle with shifts/piketts per day
- Patterns can include both shifts and piketts

**API connections:** `GET/POST /api/users`, `PUT/DELETE /api/users/{id}`, `GET/POST /api/teams`, `PUT/DELETE /api/teams/{id}`, `GET/POST /api/users/{id}/rules`, `PUT/DELETE /api/users/{id}/rules/{ruleId}`, `GET/POST /api/rotation-patterns`, `PUT/DELETE /api/rotation-patterns/{id}`

## 6.5 Shifts & Piketts (`/shifts`)

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

## 6.6 Settings (`/settings`)

**Purpose:** System administration - planning rules, holidays, backups.

**3 tabs:**

1. **Planning Rules**: Toggle algorithm settings (balance shifts, check OOF calendars, priority system, enable rotations). Saved to localStorage.

2. **Holidays**: Import Swiss public holidays (BE, ZH, VD cantons) per year. Import from CSV. Create/edit/delete custom holidays. Delete all holidays for a year. Used by the planner to skip holiday dates.

3. **Backup**: Create/download/restore/delete database backups. Upload a backup file for restore. Full DB wipe + restore with confirmation dialog.

**API connections:** `GET/POST /api/backup`, `GET /api/backup/download/{file}`, `DELETE /api/backup/{file}`, `POST /api/backup/restore`, `GET/POST /api/holidays`, `POST /api/holidays/import`, `POST /api/holidays/import-csv`

\newpage

# 7. API Reference

## 7.1 Authentication

All API endpoints (except `GET /api/cron/sync-outlook-responses`) require a valid Azure AD Bearer token:

```
Authorization: Bearer <access_token>
```

The token is validated server-side via JWKS (jose library) or Microsoft Graph fallback.

## 7.2 Endpoints Summary

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/teams` | GET, POST | List / create teams |
| `/api/teams/{id}` | GET, PUT, DELETE | Get / update / delete team |
| `/api/users` | GET, POST | List / create users (includes rules) |
| `/api/users/{id}` | GET, PUT, DELETE | Get / update / delete user (includes rules) |
| `/api/users/{id}/rules` | GET, POST | List / create user rules |
| `/api/users/{id}/rules/{ruleId}` | PUT, DELETE | Update / delete user rule |
| `/api/shifts` | GET, POST | List / create shifts |
| `/api/shifts/{id}` | GET, PUT, DELETE | Get / update / delete shift (cleans orphaned rules) |
| `/api/piketts` | GET, POST | List / create piketts |
| `/api/piketts/{id}` | PUT, DELETE | Update / delete pikett (cleans orphaned rules) |
| `/api/shift-assignments` | GET, POST | List (filtered) / bulk create assignments |
| `/api/shift-assignments/{id}` | GET, PUT, PATCH, DELETE | CRUD single assignment |
| `/api/shift-assignments/stats` | GET | Assignment statistics |
| `/api/holidays` | GET, POST | List / create holidays |
| `/api/holidays/{id}` | PUT, DELETE | Update / delete holiday |
| `/api/holidays/import` | POST | Import Swiss public holidays |
| `/api/holidays/import-csv` | POST | Import holidays from CSV |
| `/api/rotation-patterns` | GET, POST | List / create patterns |
| `/api/rotation-patterns/{id}` | GET, PUT, DELETE | CRUD single pattern |
| `/api/outlook/send-event` | POST, DELETE | Create / cancel Outlook event |
| `/api/outlook/sync` | POST | Sync Outlook responses to DB |
| `/api/backup` | GET, POST | List backups / create backup |
| `/api/backup/{fileName}` | DELETE | Delete backup file |
| `/api/backup/download/{fileName}` | GET | Download backup file |
| `/api/backup/restore` | POST | Restore from backup |
| `/api/cron/sync-outlook-responses` | GET, POST | Cron job: auto-sync responses |

## 7.3 Rate Limiting

All endpoints include rate limiting via `lib/rateLimit.ts`:

| Type | Limit |
|------|-------|
| Standard (GET) | Based on client IP |
| Write (POST/PUT/DELETE) | Stricter limit |

\newpage

# 8. Accessing Services (Web UI, CLI, Docker)

## 8.1 Application (Web UI)

| Access | URL |
|--------|-----|
| **HTTPS (production)** | `https://<YOUR_DOMAIN>:8443` |
| **HTTP (development)** | `http://localhost:3000` |

The HTTPS access goes through Nginx (TLS termination). HTTP access is direct to the Next.js server (no TLS).

## 8.2 PostgreSQL (Database)

PostgreSQL is **not exposed** outside the Docker network by default.

**From within Docker containers:**
```
Host: sap-postgres
Port: 5432
User: sa_sap
Database: shiftautoplanner
```

**From host machine (via Docker exec):**
```bash
# Interactive SQL shell
docker exec -it sap-postgres psql -U sa_sap -d shiftautoplanner

# List all tables
docker exec -it sap-postgres psql -U sa_sap -d shiftautoplanner -c "\dt"

# Run a query
docker exec -it sap-postgres psql -U sa_sap -d shiftautoplanner -c "SELECT COUNT(*) FROM \"User\""
```

**Note:** If you need direct access from your host, you can temporarily add a port mapping in `docker-compose.yml`:
```yaml
sap-postgres:
  ports:
    - "5432:5432"  # Add this line (remove in production)
```

## 8.3 Prisma Studio (Database GUI)

Prisma Studio provides a visual database browser. It is **not exposed in production** but can be used for debugging.

**From your development machine** (requires Node.js installed locally):
```bash
cd SAP_Almalinux
npx prisma studio --url "postgresql://sa_sap:YOUR_PASSWORD@localhost:5432/shiftautoplanner"
```

This opens a web UI at `http://localhost:5555` where you can browse and edit all tables.

**Important:** Requires PostgreSQL port 5432 to be accessible from your machine (see section 8.2).

## 8.4 Docker Container Management

```bash
# View all containers status
docker ps

# View all logs (live)
docker compose logs -f

# View only app logs
docker logs -f sap-app

# View only database logs
docker logs -f sap-postgres

# View only nginx logs
docker logs -f sap-nginx

# Restart only the app
docker compose restart app

# Full rebuild (no cache)
docker compose build --no-cache app && docker compose up -d app

# Stop everything
docker compose down

# Stop and remove volumes (WARNING: deletes database!)
docker compose down -v
```

## 8.5 Nginx (Reverse Proxy)

Nginx is configured via `nginx/conf.d/sap.conf`.

**Key behaviors:**
- HTTP (port 8080) automatically redirects to HTTPS (port 8443)
- Self-signed certificates are auto-generated on first boot via `nginx/init-certs.sh`
- Certificate validity: 365 days, RSA 2048-bit
- TLS versions: TLSv1.2 and TLSv1.3

**Security headers configured:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `server_tokens off` (hides nginx version)

**To change the domain name:**
1. Edit `nginx/conf.d/sap.conf`: replace `sap.lab.sr.bnc.ch` with your domain
2. Edit `nginx/sap-san.cnf`: update the DNS entries
3. Delete the certificate volume and restart:
   ```bash
   docker volume rm sap_almalinux_nginx-certs
   docker compose restart nginx
   ```

## 8.6 AlmaLinux Host Server

**SSH access:**
```bash
ssh <SSH_USER>@<SERVER_IP>
```

**Project location (production):**
```bash
cd /opt/SAP_Almalinux   # or the path set in DEPLOY_PATH
```

**Common server tasks:**
```bash
# Check Docker service status
sudo systemctl status docker

# View disk usage
df -h

# View container resource usage
docker stats

# View recent Docker events
docker events --since 1h
```

\newpage

# 9. Deployment Guide

## 9.1 Prerequisites

- A Linux server (AlmaLinux 9.x recommended) with:
  - Docker 27.x
  - Docker Compose v2
  - Git
- A Microsoft Azure AD (Entra ID) tenant with an app registration
- Network access to `login.microsoftonline.com` and `graph.microsoft.com`

## 9.2 Azure AD (Entra ID) App Registration

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

## 9.3 Fresh AlmaLinux Installation

If starting from a clean AlmaLinux 9.x server, follow these steps to prepare the environment.

### Step 1: System Update

```bash
sudo dnf update -y
sudo dnf install -y git nano curl wget
```

### Step 2: Install Docker Engine

```bash
# Add the Docker repository
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Install Docker and Compose plugin
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to the docker group (log out and back in after this)
sudo usermod -aG docker $USER
```

### Step 3: Install Node.js 20 LTS (Optional — for local Prisma Studio)

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
```

### Step 4: Configure Firewall

```bash
sudo firewall-cmd --permanent --add-port=8443/tcp
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
```

### Step 5: Clone and Configure

```bash
git clone https://gitlab.bnc.ch/bnc_internal_operations/SAP_Almalinux.git
cd SAP_Almalinux
cp .env.example .env
nano .env   # Fill in all values (see Section 9.4 below)
```

### Step 6: Configure Nginx Domain

Edit three files to set your domain name:

- `nginx/conf.d/sap.conf` — replace `sap.lab.sr.bnc.ch` with your domain
- `nginx/init-certs.sh` — update the domain for certificate generation
- `nginx/sap-san.cnf` — update the DNS entries for the self-signed certificate

### Step 7: Build and Start

```bash
docker compose build --no-cache app
docker compose up -d
```

### Step 8: Verify

```bash
# Check all 3 containers are running
docker ps

# Check app logs (watch for successful startup)
docker logs -f sap-app

# Test HTTPS access
curl -k https://localhost:8443
```

## 9.4 Server Setup (Application Configuration)

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

## 9.4 What Happens at Container Startup

The `docker-entrypoint.sh` script runs automatically when the app container starts:

1. **Wait for database** (30 retries, 2s each = ~60s max): Tests PostgreSQL connection
2. **Run Prisma migrations**: `prisma migrate deploy` (fallback: `prisma db push`)
3. **Fix backup permissions**: Ensures the app user can write to the backups volume
4. **Start the app**: Runs Next.js server as unprivileged user `nextjs` (UID 1001)

## 9.5 Updating the Application

```bash
cd /path/to/SAP_Almalinux
git pull
docker compose build --no-cache app
docker compose up -d app
```

PostgreSQL and Nginx are not rebuilt - only the app container is replaced.

**Important:** Always use `--no-cache` when rebuilding to ensure all code changes are included. Without it, Docker may use cached layers with old code.

## 9.6 Updating Dependencies (npm packages)

### Step 1: Check for outdated packages (on your development machine)

```bash
npm outdated
```

### Step 2: Update minor/patch versions (safe)

```bash
npm update
```

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

# 10. CI/CD Pipeline (GitLab)

## 10.1 Pipeline Overview

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

## 10.2 Required GitLab CI/CD Variables

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

## 10.3 GitLab Runner Setup

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

# 11. Environment Variables Reference

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

# 12. Backup and Restore

## 12.1 Via Web UI

Go to **Settings > Backup** tab:
- **Create Backup**: Click the button to dump all database tables to a JSON file
- **Download**: Download any backup file
- **Restore**: Select a backup and confirm to wipe + restore the entire database
- **Upload**: Upload a backup JSON file from your computer
- **Delete**: Remove a backup file

**Warning:** Restore replaces ALL data in the database. This is irreversible.

## 12.2 Via Command Line

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

# 13. Project Structure

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
|       +-- cron/
|-- lib/                     # Shared libraries
|   |-- auth.ts              # Azure AD token validation
|   |-- prisma.ts            # Prisma client singleton
|   |-- rateLimit.ts         # Rate limiter
|   |-- validation.ts        # Zod schemas (incl. rule schemas)
|   |-- securityLogger.ts    # Security event logging
|   |-- hooks/               # React hooks (useAuthFetch, etc.)
|   +-- msalConfig.ts        # MSAL configuration
|-- contexts/                # React contexts
|   |-- AuthContext.tsx       # Authentication context
|   +-- RotationPatternsContext.tsx
|-- prisma/
|   |-- schema.prisma        # Database schema (incl. UserRule, UserRuleType)
|   +-- migrations/          # Prisma migrations
|-- messages/                # i18n translations
|   |-- en.json
|   |-- fr.json
|   +-- de.json
|-- i18n/                    # i18n config
|-- nginx/                   # Nginx config
|-- scripts/                 # Backup/restore scripts
|-- docs/                    # Documentation
|-- docker-compose.yml
|-- Dockerfile
|-- docker-entrypoint.sh
|-- prisma.config.ts
+-- .gitlab-ci.yml
```

\newpage

# 14. Troubleshooting

## 14.1 Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| 500 errors on all API routes | SSL connection issue with Prisma 7 | Ensure `sslmode=prefer` is not in DATABASE_URL, or use the code fix in `lib/prisma.ts` |
| Login redirect fails | Wrong redirect URI in Azure AD | Verify `NEXT_PUBLIC_AZURE_AD_REDIRECT_URI` matches Azure Portal |
| Calendar events not sent | Missing Graph permissions | Ensure `Calendars.ReadWrite` + `Calendars.ReadWrite.Shared` are consented |
| OOF not detected | User email mismatch | User email in SAP must match their Microsoft account email exactly |
| Container exits immediately | Database not ready | Check `docker logs sap-app` - entrypoint retries 30 times |
| Build uses old code | Docker cache | Always use `docker compose build --no-cache app` |
| Build fails (Turbopack) | Custom webpack config incompatible | Build uses `--webpack` flag (set in package.json) |
| Prisma migration fails | First deployment | Entrypoint falls back to `prisma db push` automatically |
| Backup restore fails | Empty backup list | Upload a backup file via the Settings page |
| User rules not applied | Rules disabled | Check that the rule has `enabled: true` (toggle switch) |
| Rotation resets each tranche | Old bug (fixed) | Rotation now uses ISO week numbers for continuity |
| DOUBLE_SHIFT duplicate pikett | Two rules target same pikett | First processed wins, second is skipped |
| MAX_LOAD not working | Shift not matching | Verify the shiftId in the rule matches the shift being assigned |

## 14.2 Useful Commands

```bash
# View all container logs
docker compose logs -f

# View app logs only
docker logs -f sap-app

# Access PostgreSQL directly
docker exec -it sap-postgres psql -U sa_sap -d shiftautoplanner

# Check database tables
docker exec -it sap-postgres psql -U sa_sap -d shiftautoplanner -c "\dt"

# Check user rules in database
docker exec -it sap-postgres psql -U sa_sap -d shiftautoplanner -c 'SELECT u."firstName", u."lastName", r."type", r."config", r."enabled" FROM "UserRule" r JOIN "User" u ON r."userId" = u."id"'

# Count assignments per user
docker exec -it sap-postgres psql -U sa_sap -d shiftautoplanner -c 'SELECT u."firstName", u."lastName", COUNT(a.id) as total FROM "User" u LEFT JOIN "ShiftAssignment" a ON u.id = a."userId" GROUP BY u.id ORDER BY total DESC'

# Restart only the app
docker compose restart app

# Full rebuild
docker compose build --no-cache app && docker compose up -d app
```

## 14.3 Debugging the Planner

If the planner produces unexpected results:

1. **Click on the problematic day** in the calendar to open the day detail dialog
2. **Check unavailable users**: Each user shows a reason (holiday, OOF, week parity, max load, consecutive, etc.)
3. **Check user rules**: Go to Users > Edit user > Rules section to see active rules
4. **Check rotation patterns**: Verify the rotation pattern is assigned and the cycle week matches
5. **Check holidays**: Go to Settings > Holidays to verify holidays are imported for the correct year and cantons
6. **Check availability**: Go to Users > Edit user > Availability to verify the user is configured to work on the day in question

## 14.4 Logs and Audit Trail

- **Application logs**: `docker logs -f sap-app`
- **Audit trail**: The `AuditLog` table records all create/update/delete operations with timestamps, user ID, and data
- **Security logs**: `lib/securityLogger.ts` logs authentication failures and suspicious activity

\newpage

# 15. Quick Reference Card

## URLs and Ports

| Service | URL |
|---------|-----|
| Web App (HTTPS) | `https://<DOMAIN>:8443` |
| Web App (HTTP dev) | `http://localhost:3000` |
| PostgreSQL (Docker internal) | `sap-postgres:5432` |
| Prisma Studio (dev only) | `http://localhost:5555` |

## Entity Creation Order

```
1. Holidays  →  Settings > Holidays > Import
2. Teams     →  Users > Teams > Create Team
3. Users     →  Users > Create User (requires Team)
4. Shifts    →  Shifts > Create Shift (requires Team)
5. Piketts   →  Shifts > Piketts > Create Pikett (requires Team)
6. Patterns  →  Users > Create Rotation Pattern (optional, requires Shifts)
7. Rules     →  Users > Edit User > Rules (optional, requires Shifts/Piketts)
8. Plan      →  Planner > Preview > Send Invitations
```

## Algorithm Priority Order

```
1. Public holidays (per canton)     → ALWAYS checked
2. Work availability (schedule)     → ALWAYS checked
3. Week parity rule (WEEK_PARITY)   → If rule exists and enabled
4. Already assigned today           → ALWAYS checked
5. Out of Office (Outlook)          → If "Check calendars" ON
6. Min consecutive days             → If shift minConsecutiveDays > 1
7. Max load (MAX_LOAD)              → If rule exists and enabled
```

## Docker Commands Cheat Sheet

```bash
docker ps                                           # Status
docker compose logs -f                              # All logs
docker logs -f sap-app                              # App logs
docker compose restart app                          # Restart app
docker compose build --no-cache app && docker compose up -d app  # Rebuild
docker exec -it sap-postgres psql -U sa_sap -d shiftautoplanner  # DB shell
docker exec sap-app npx tsx scripts/backup.ts       # Backup
```
