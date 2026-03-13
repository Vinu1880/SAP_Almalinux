---
title: "ShiftPilot - User Guide"
subtitle: "BNC / Axians - Internal Operations"
date: "March 2026"
author: "BNC Internal Operations"
---

\newpage

# 1. Getting Started

## 1.1 Logging In

Open your browser and go to `https://<YOUR_DOMAIN>`.

Click **"Sign in with Azure AD"** and authenticate with your Microsoft account (MFA required). You are redirected to the Dashboard.

<!-- [Screenshot: Login page with "Sign in with Azure AD" button] -->

\newpage

## 1.2 Navigation

The top navigation bar provides access to all pages:

| Icon | Page | Purpose |
|------|------|---------|
| 📊 | **Dashboard** | Monitor assignments, sync responses, resend/delete |
| 👥 | **Users** | Manage users, teams, rotation patterns, rules |
| 🕐 | **Shifts** | Manage shifts and piketts (on-call) |
| 📅 | **Planner** | Generate plans, preview, send Outlook invitations |
| ⚙️ | **Settings** | Planning rules, holidays, backups |

**Top-right corner:**
- **Language switcher**: Switch between English, French, German
- **User avatar**: Shows your name, email, and Logout button

<!-- [Screenshot: Navigation bar with all 5 icons highlighted] -->

\newpage

# 2. Initial Setup (First-Time Only)

Follow these steps **in order** — some entities depend on others.

```
1. Import Holidays   →  Settings > Holidays
2. Create Teams      →  Users > Teams tab
3. Create Users      →  Users > Users tab
4. Create Shifts     →  Shifts > Shifts tab
5. Create Piketts    →  Shifts > Piketts tab
6. (Optional) Create Rotation Patterns  →  Users > Rotation Patterns
7. (Optional) Add User Rules            →  Users > Edit user > Rules
8. Generate a Plan   →  Planner
```

\newpage

# 3. Settings Page

## 3.1 Planning Rules Tab

Controls how the automatic planner behaves.

| Setting | What it does |
|---------|-------------|
| **Enable rotations** | Uses rotation patterns for assignment |
| **Fair distribution** | Balances workload using assignment ratio |
| **Check calendars** | Checks Outlook OOF/busy status before assigning |
| **Priority system** | Processes shifts with fewer eligible users first |

Each toggle saves automatically.

<!-- [Screenshot: Planning Rules tab with all 4 toggles] -->

\newpage

## 3.2 Holidays Tab

Holidays determine when users are **not** assigned. The planner checks each user's canton (location) to know which holidays apply to them.

### Buttons

| Button | Action |
|--------|--------|
| **Import standards** | Imports Swiss public holidays for cantons BE, ZH, VD for the selected year |
| **Import CSV** | Upload a CSV file with `date` and `name` columns |
| **Add holiday** | Create a custom holiday (name, date, cantons, type) |
| **Delete all** | Remove all holidays for the selected year |

### Holiday Fields

| Field | Description |
|-------|-------------|
| **Name** | Holiday name (e.g., "Christmas") |
| **Date** | The holiday date |
| **Cantons** | Which cantons this applies to (BE, ZH, VD, or ALL) |
| **Type** | Federal / Cantonal / Custom |
| **Recurring** | Toggle — if ON, repeats every year automatically |

<!-- [Screenshot: Holidays tab with imported holidays and Add holiday dialog] -->

\newpage

## 3.3 Backup Tab

### Buttons

| Button | Action |
|--------|--------|
| **Create Backup** | Saves the entire database to a JSON file |
| **Download** | Download a backup file to your computer |
| **Restore** | Wipe the database and restore from a selected backup — **irreversible** |
| **Upload** | Upload a backup JSON file from your computer |
| **Delete** (trash icon) | Remove a backup file |

### Scheduled Backup

| Setting | Description |
|---------|-------------|
| **Enable** | Toggle automatic backups ON/OFF |
| **Frequency** | Daily / Weekly / Monthly |
| **Day of week** | (Weekly only) Which day to run |
| **Day of month** | (Monthly only) Which day to run |
| **Time** | What time to create the backup |
| **Max backups** | Maximum number of backup files to keep (oldest are deleted) |

All scheduled backup settings save automatically when changed.

<!-- [Screenshot: Backup tab with backup list and scheduled backup settings] -->

\newpage

# 4. Users Page

The Users page has 3 tabs: **Users**, **Teams**, and **Rotation Patterns**.

## 4.1 Teams Tab

Teams group users together. Every user and shift belongs to a team.

### Sort & Filter

| Sort option | Description |
|-------------|-------------|
| **By name** | Sort teams alphabetically |
| **By members** | Sort teams by number of members |
| **Ascending / Descending** | Toggle sort order |

The team count is shown in the filter bar.

### Buttons

| Button | Action |
|--------|--------|
| **Create Team** | Opens the team creation dialog |
| **Edit** (pencil icon) | Edit team name, description, color, lead |
| **Delete** (trash icon) | Delete the team (only if no members) |

### Team Fields

| Field | Description |
|-------|-------------|
| **Name** | Team name (e.g., "SEC", "CDC") |
| **Description** | Optional description |
| **Color** | Color used in the planner calendar |
| **Team Lead** | Select a user as team leader (optional) |

<!-- [Screenshot: Teams tab with team cards and Create Team dialog] -->

\newpage

## 4.2 Users Tab

### Buttons

| Button | Action |
|--------|--------|
| **Create user** | Opens the user creation dialog |
| **Grid/List view** | Switch between card view and table view |
| **Edit** (pencil icon) | Edit user details, availability, rules, rotation |
| **Duplicate** (copy icon) | Create a copy of the user (opens creation dialog pre-filled) |
| **Delete** (trash icon) | Delete the user |

### User Fields

| Field | Required | Description |
|-------|----------|-------------|
| **First name / Last name** | Yes | Full name |
| **Email** | Yes | Microsoft email (used for Outlook integration) |
| **Team** | Yes | Which team the user belongs to |
| **Location (canton)** | No | BE, ZH, or VD — determines which holidays apply |
| **Phone** | No | Phone number |
| **Role** | No | Job role |
| **Notes** | No | Free text notes |
| **Status** | Yes | Active or Inactive |

<!-- [Screenshot: Users tab in grid view with user cards] -->

\newpage

### Availability Editor

For part-time users, configure which half-days they work.

- Toggle **morning** and **afternoon** for each day of the week (Mon–Fri)
- Work percentage is auto-calculated
- Full-time (100%) means all half-days are active
- The planner uses this to know if a user can be assigned to a shift on a given day

<!-- [Screenshot: Availability editor with morning/afternoon toggles] -->

\newpage

### User Rules

Rules add constraints to the automatic planner. Access via **Edit user > Rules section**.

| Button | Action |
|--------|--------|
| **Add rule** (+ icon) | Add a new rule to this user |
| **Toggle** (switch) | Enable/disable a rule without deleting it |
| **Delete** (trash icon) | Permanently remove a rule |

#### Rule Types

**Week Parity (WEEK_PARITY)**
Restricts the user to only **odd** or **even** ISO weeks.
- Use case: Two users alternate pikett — one on odd weeks, one on even weeks
- Config: Select "Odd weeks" or "Even weeks"
- Limit: 1 per user

**Double-Shift (DOUBLE_SHIFT)**
When the user is assigned to a **trigger shift**, they are automatically also assigned to a **linked shift** on the same date.
- Use case: When Jean-Marc is on CDC Pikett, he should also be on SEC Pikett
- Config: Select trigger shift/pikett and linked shift/pikett
- Limit: 1 per trigger shift
- Supports chaining (A→B and B→C results in A→B→C)

**Max Load (MAX_LOAD)**
Limits the maximum percentage of assignments for a specific shift.
- Use case: A part-time user should not be assigned more than 50% of a shift
- Config: Select shift and set max percentage (1-100%)
- Limit: 1 per shift per user

<!-- [Screenshot: Rules section in edit user dialog showing all 3 rule types] -->

\newpage

### Rotation Patterns

Assign a repeating multi-week cycle to a user.

**Step 1: Edit the user**
1. Enable **"Automatic rotation"**
2. Select a pattern from the dropdown (or create a new one)
3. Save

**Step 2: The planner uses it**
- When generating a plan with "Enable rotations" ON, the planner places rotation users on their designated shifts first
- Uses ISO week numbers to keep the cycle in sync across planning periods

<!-- [Screenshot: Rotation pattern assignment in edit user dialog] -->

\newpage

## 4.3 Rotation Patterns Tab

### Buttons

| Button | Action |
|--------|--------|
| **Create Rotation Pattern** | Opens the pattern creation dialog |
| **Edit** (pencil icon) | Edit an existing pattern |
| **Delete** (trash icon) | Delete a pattern |

### Pattern Fields

| Field | Description |
|-------|-------------|
| **Pattern name** | Descriptive name (e.g., "Rotation SEC 3-week") |
| **Cycle duration** | Number of weeks in the cycle (1–6 weeks) |
| **User** | Select a user to load their available shifts |
| **Week grid** | For each week × day, assign a shift or pikett |

- Days where the user is not available (from their availability schedule) are grayed out
- Piketts are shown with "(Pikett)" label
- Click a cell to assign/change/remove a shift for that day

<!-- [Screenshot: Rotation pattern grid with week configuration] -->

\newpage

# 5. Shifts Page

The Shifts page has 2 tabs: **Shifts** and **Piketts**. Use the toggle buttons to switch between them. Filters (search, shift/pikett dropdown, status) reset when switching tabs.

### Filters

| Filter | Description |
|--------|-------------|
| **Search** | Search by shift or pikett name |
| **Shift/Pikett filter** | Filter by a specific shift or pikett (dropdown lists all items with their color) |
| **Status** | Filter by Active / Inactive |

## 5.1 Shifts Tab

### Buttons

| Button | Action |
|--------|--------|
| **Create Shift** | Opens the shift creation dialog |
| **Edit** (pencil icon) | Edit shift details |
| **Duplicate** (copy icon) | Create a copy of the shift (opens creation dialog pre-filled) |
| **Delete** (trash icon) | Delete the shift |

### Shift Fields

| Field | Description |
|-------|-------------|
| **Name** | Shift name (e.g., "Morning Support") |
| **Team** | Which team this shift belongs to |
| **Start time / End time** | Time range (e.g., 07:30 – 12:00) |
| **Days of week** | Active days (checkboxes Mon–Sun) |
| **Members required** | How many people needed per day (usually 1) |
| **Priority** | LOW / MEDIUM / HIGH / CRITICAL |
| **Color** | Color used in the planner calendar |
| **Shared Mailbox** | Email address used to send Outlook invitations |
| **Min consecutive days** | How many consecutive days the same person should be assigned (1-3). Default: 1 (no preference) |
| **Status** | Active / Inactive / Archived |

### Eligible Personnel

By default, all users in the selected team are eligible. You can:
- **Exclude** specific team members (they won't be assigned)
- **Include** users from other teams (cross-team assignments)

<!-- [Screenshot: Shift creation form with member selector] -->

\newpage

## 5.2 Piketts Tab (On-Call)

Piketts are weekly on-call assignments — typically one person per week.

### Buttons

| Button | Action |
|--------|--------|
| **Create Pikett** | Opens the pikett creation dialog |
| **Edit** (pencil icon) | Edit pikett details |
| **Duplicate** (copy icon) | Create a copy of the pikett (opens creation dialog pre-filled) |
| **Delete** (trash icon) | Delete the pikett |

### Pikett Fields

| Field | Description |
|-------|-------------|
| **Name** | Pikett name (e.g., "SEC Pikett") |
| **Team** | Which team this pikett belongs to |
| **Start week / End week** | ISO week range (e.g., "2026-W09" to "2026-W22") |
| **Days of week** | Active days (checkboxes Mon–Sun) |
| **24/7** | Toggle for continuous on-call |
| **Color** | Color used in the planner calendar |
| **Status** | Active / Inactive |

### Eligible Personnel

Same as shifts — include/exclude users from the assignment pool.

<!-- [Screenshot: Pikett creation form] -->

\newpage

# 6. Planner Page

The Planner is the core of the application — it generates shift assignments and sends Outlook invitations.

## 6.1 Configuration Panel (Left Side)

### Date Range

| Control | Action |
|---------|--------|
| **Start date** | First day of the planning period |
| **End date** | Last day of the planning period |
| **Month navigation** (← →) | Move calendar by month |

### Shift/Pikett Selection

Check the shifts and piketts you want to include in the plan. Only checked items will be scheduled.

<!-- [Screenshot: Left panel with date range, shift checkboxes, pikett checkboxes] -->

\newpage

### Settings Panel (Gear Icon ⚙️)

Click the gear icon to open planning settings:

| Setting | Default | Effect |
|---------|---------|--------|
| **Enable rotations** | ON | Uses rotation patterns |
| **Fair distribution** | ON | Balances workload across users |
| **Check calendars** | ON | Checks Outlook OOF/busy before assigning |
| **Priority system** | ON | Assigns shifts with fewer members first |

<!-- [Screenshot: Settings panel expanded with all toggles] -->

\newpage

## 6.2 Calendar View (Main Area)

### Buttons

| Button | Action |
|--------|--------|
| **Preview** | Generate the plan (does NOT send invitations yet) |
| **Send Invitations** | Send Outlook calendar events for all assignments |
| **← → Month arrows** | Navigate between months |

### Calendar Display

After clicking **Preview**, each day shows color-coded badges:
- Each badge = one shift assignment
- Badge color = shift color
- Badge text = shift abbreviation + assigned user initials
- Empty badge (gray) = no user available for that slot
- 🛡️ icon = pikett (on-call) assignment

<!-- [Screenshot: Calendar view with color-coded assignment badges] -->

\newpage

## 6.3 Day Detail Dialog

Click on any day in the calendar to see full details.

### For each shift on that day:

**Assigned Users** (green section)
- Shows who is assigned
- Click to **unassign** and pick a different user

**Available Users** (blue section)
- Users who could have been assigned but weren't
- Click on a user to **reassign** the shift to them (manual override)

**Unavailable Users** (red section)
- Users who cannot work this day, with the reason:
  - 🏖️ Public holiday (with name)
  - 📅 Out of Office
  - ⏰ Not working today (part-time)
  - 🔄 Already assigned to another shift
  - ⚡ Consecutive days (per-shift setting)
  - 📊 Max load reached
  - 🔢 Week parity (odd/even)

<!-- [Screenshot: Day detail dialog showing assigned, available, and unavailable users] -->

\newpage

## 6.4 Sending Invitations

After previewing and reviewing the plan:

1. Click **"Send Invitations"**
2. The app creates Outlook calendar events for each assignment
3. Each assigned user receives an invitation they can **Accept** or **Refuse**
4. A progress dialog shows real-time sending progress with success/error counts
5. Once done, go to **Dashboard** to monitor responses

**Important:**
- Only assignments with a user are sent (empty slots are skipped)
- The invitation is sent from the shift's **shared mailbox**
- If a shift has no shared mailbox configured, the invitation cannot be sent

<!-- [Screenshot: Send invitations button and progress indicator] -->

\newpage

# 7. Dashboard Page

The Dashboard monitors all sent assignments and their responses. It supports both **Shift** and **Pikett** assignments via a mode toggle.

## 7.1 Mode Toggle (Shifts / Pikett)

At the top of the dashboard, a toggle switches between **Shifts** and **Pikett** mode. All data — KPI cards, table, user stats, calendar, and export — updates to reflect the selected mode.

## 7.2 KPI Cards

| Card | What it shows |
|------|--------------|
| **Accepted** | Assignments accepted by users |
| **Refused** | Declined by users |
| **Pending** | Waiting for user response |
| **Total** | Total number of assignments |

Cards display data for the selected mode (Shifts or Pikett) and the active date filter.

## 7.3 Filters

| Filter | Options |
|--------|---------|
| **Date range** | 7 days / 30 days / 90 days / 180 days / All |
| **Mode** | Shifts / Pikett (toggle button) |
| **Team** | Filter by team |
| **User** | Filter by specific user |
| **Shift/Pikett** | Filter by specific shift or pikett |
| **Status** | Accepted / Pending / Tentative / Refused / Cancelled |

Filters reset when switching between Shifts and Pikett modes.

## 7.4 Views

### Recent Assignments View (Table)

Paginated table of all assignments with:
- Date, shift/pikett name, assigned user, status badge
- Sortable by date (ascending/descending)
- **Resent assignments** are visually marked with an amber left border and a refresh icon, indicating they were created to replace a refused assignment

### Users View

Per-user statistics with:
- **Shift/Pikett details**: For each shift or pikett, shows a donut ring visualization with segments for accepted (green), pending (orange), refused (red), and cancelled (gray) counts
- **CSV export**: Download user statistics

### Calendar View

Monthly calendar with assignment badges:
- Each badge shows the shift/pikett color and assigned user initials
- **Smart filtering**: When an assignment has been accepted for a date, refused/cancelled assignments for the same shift/pikett are hidden — only the accepted assignment is shown
- Click on any day to see the full detail dialog with all assignments

\newpage

## 7.5 Action Buttons

| Button | Action |
|--------|--------|
| **Sync** | Fetch latest Accept/Refuse/Tentative responses from Outlook |
| **Resend** | Reassign a refused assignment to a different available user |
| **Delete** (trash icon) | Remove an assignment and cancel the Outlook event (attendees are notified) |
| **Export CSV** | Download assignments or user statistics as CSV |

### How Sync Works

1. Click **Sync** or wait for **auto-sync** (runs every 15 minutes, countdown shown next to the Sync button)
2. The app reads each assignment's Outlook event via Microsoft Graph API
3. Updates status: Accepted / Tentative / Refused
4. Detects cancellations: if an event was deleted or cancelled from the shared mailbox in Outlook, the assignment is automatically marked as **Cancelled**
5. Refused assignments can be **resent** to another user

### How Resend Works

1. Click the **Resend** button on a refused assignment
2. A dialog shows available users for that date/shift (respecting availability rules)
3. Select a new user — the original assignment is marked as resent, and a new assignment is created
4. The Outlook event is cancelled for the original user and a new invitation is sent to the replacement
5. The new assignment row is visually marked with an amber border to show it was resent

\newpage

# 8. Workflow Summary

```
Setup (once):
  Settings → Import holidays
  Users → Create teams → Create users
  Shifts → Create shifts → Create piketts
  (Optional) Users → Create rotation patterns → Assign to users
  (Optional) Users → Edit users → Add rules

Monthly workflow:
  1. Planner → Select shifts/piketts → Set date range → Preview
  2. Review calendar → Manual overrides if needed
  3. Send Invitations
  4. Dashboard → Sync responses → Resend refused shifts
```

\newpage

# 9. Tips

- **Always import holidays before generating a plan** — otherwise users will be assigned on public holidays
- **Check calendars should be ON** — this prevents assigning users who are on vacation (OOF in Outlook)
- **Use rotation patterns** for users who follow a fixed weekly cycle — it reduces manual overrides
- **WEEK_PARITY** is useful for pikett alternation — user A on odd weeks, user B on even weeks
- **DOUBLE_SHIFT** ensures linked assignments — if a user is on one pikett, they are automatically on the linked one too
- **MAX_LOAD** prevents overloading part-time users — set their max percentage to match their work contract
- **After sending invitations**, come back to the Dashboard — **auto-sync** checks for responses every 15 minutes, or click **Sync** manually
- **Tentative responses** (orange) mean the user has provisionally accepted — follow up if needed
- **Resend refused shifts promptly** — the replacement user is checked for availability in real-time
- **Calendar view hides refused users** once someone has accepted the same shift for that date
- **If you cancel an event from the shared mailbox** in Outlook, the next sync will automatically mark it as Cancelled in ShiftPilot
- **Deleting an assignment** from the Dashboard will also cancel the Outlook event and notify the user
- **Use Pikett mode** in the Dashboard to monitor on-call assignments separately from regular shifts
- **Backup regularly** — use scheduled backup or create manual backups before major changes
