# ShiftPilot

Shift and on-call (pikett) planner. Generates a fair schedule, sends the assignments as
Outlook invitations from a shared mailbox, and tracks the answers.

- Automatic planning with fairness rules, Outlook absences, holidays and rotations
- Manual edits, split shifts, people in copy, drafts shared between admins
- Dashboard with response sync, resend and per-day pikett changes
- Backups, audit log, English / French / German

**Stack:** Next.js 16 · React 19 · Prisma 7 · PostgreSQL 16 · Azure AD (MSAL) · Microsoft Graph · Docker / Podman

## Prerequisites

`npm` and `npx` come with Node.js — there is nothing else to install globally. Prisma,
TypeScript and tsx are project dependencies, installed by `npm ci`. Use the Node.js major
version of the `Dockerfile` (`FROM node:20-alpine`) so local builds match the container.

Development machine (Windows, PowerShell):

```powershell
winget install --id OpenJS.NodeJS.20 -e     # Node.js 20 + npm + npx
winget install --id Git.Git -e
winget install --id Docker.DockerDesktop -e
```

Open a new terminal, then check:

```powershell
node -v; npm -v; npx -v; git --version; docker --version
```

Server (AlmaLinux 9): the app is built inside the container, so Node.js is not needed
on the host.

```bash
sudo dnf install -y git podman epel-release
sudo dnf install -y podman-compose
```

Sources: [Node.js downloads](https://nodejs.org/en/download) ·
[Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/) ·
[Podman installation](https://podman.io/docs/installation)

## Configuration

Create `.env` at the root (never committed):

```dotenv
DATABASE_URL=postgresql://<user>:<url-encoded-password>@sap-postgres:5432/shiftpilot?schema=public
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=<client id>
NEXT_PUBLIC_AZURE_AD_TENANT_ID=<tenant id>
NEXT_PUBLIC_AZURE_AD_REDIRECT_URI=https://<host>/
NEXT_PUBLIC_URL=https://<host>
CRON_SECRET=<random string>
```

`NEXT_PUBLIC_*` values are baked in at build time: rebuild after changing them.

- **Azure app registration:** single-page application, delegated Graph permissions
  `User.Read`, `Calendars.Read`, `Calendars.ReadWrite`, `Calendars.ReadWrite.Shared`.
  No client secret.
- **Shared mailboxes:** planners need Editor rights on each sender mailbox's calendar
  (`Add-MailboxFolderPermission -Identity <mailbox>:\Calendar -User <planner> -AccessRights Editor`).

## Run

Containers (app, database, Nginx):

```bash
docker compose up -d --build        # Podman: podman-compose up -d --build
```

The schema is applied automatically at startup. App on `http://localhost:3000`,
Nginx on `https://localhost:8443`.

Local development:

```bash
npm ci --legacy-peer-deps
docker compose up -d sap-postgres
npx prisma generate
npx prisma db push --url "postgresql://<user>:<password>@localhost:5432/shiftpilot?schema=public"
npm run dev
```

Before committing: `npx tsc --noEmit -p .` must print nothing.

Health check: pages answer `200`, `/api/shifts` answers `401` (authentication enforced).

## Keeping it up to date

Commands are run from the project folder: the VS Code terminal (PowerShell) on the
development machine, a shell on the AlmaLinux server.

### Deploy a new version

Development (Docker Desktop):

```powershell
docker exec sap-postgres pg_dump -U sa_sap -d shiftpilot -f /tmp/before-update.sql   # safety backup
docker cp sap-postgres:/tmp/before-update.sql ./backups/
git pull
docker compose up -d --build app
docker logs sap-app --tail 30                                                         # "Ready", no Prisma error
curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:3000/api/shifts               # 401
```

Production (AlmaLinux, Podman):

```bash
podman exec shiftpilot-postgres pg_dump -U sa_shiftpilot -d shiftpilot -f /tmp/before-update.sql
podman cp shiftpilot-postgres:/tmp/before-update.sql ./backups/
git pull
podman build -t shiftpilot-app:latest .
podman-compose up -d app
podman logs shiftpilot-app --tail 30
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/shifts            # 401
```

Schema changes are applied by the container at startup (`prisma db push`); if it fails,
the container stops and the logs show why.

### Update dependencies

1. See what is behind and what is vulnerable:

   ```powershell
   npm outdated
   npm audit --audit-level=high
   ```

2. Patches and minor versions, all at once:

   ```powershell
   npm update --legacy-peer-deps
   ```

3. Major versions, one package family at a time, one commit each. Read the upgrade
   guide first:

   | Package family | Command | Upgrade notes |
   |---|---|---|
   | Next.js | `npm install next@latest eslint-config-next@latest --legacy-peer-deps` | [Upgrade guide](https://nextjs.org/docs/app/guides/upgrading) · [Releases](https://github.com/vercel/next.js/releases) |
   | React | `npm install react@latest react-dom@latest @types/react@latest @types/react-dom@latest --legacy-peer-deps` | [Versions](https://react.dev/versions) |
   | Prisma | `npm install prisma@latest @prisma/client@latest @prisma/adapter-pg@latest --legacy-peer-deps` | [Upgrade guides](https://www.prisma.io/docs/orm/more/upgrade-guides) · [Releases](https://github.com/prisma/prisma/releases) |
   | Tailwind CSS | `npm install tailwindcss@latest @tailwindcss/postcss@latest --legacy-peer-deps` | [Upgrade guide](https://tailwindcss.com/docs/upgrade-guide) |
   | next-intl | `npm install next-intl@latest --legacy-peer-deps` | [Releases](https://github.com/amannn/next-intl/releases) |
   | MSAL | `npm install @azure/msal-browser@latest @azure/msal-react@latest --legacy-peer-deps` | [Releases](https://github.com/AzureAD/microsoft-authentication-library-for-js/releases) |

   The packages on one line must always stay on the same version.

4. Check after each step:

   ```powershell
   npx prisma generate
   npx tsc --noEmit -p .
   npm run build
   docker compose up -d --build app
   ```

   Then open the app and go through the dashboard and the planner.

5. Roll back a failed step:

   ```powershell
   git checkout -- package.json package-lock.json
   npm ci --legacy-peer-deps
   ```

Runtime images: Node.js and PostgreSQL versions are set in `Dockerfile` and
`docker-compose.yml` — see [Node.js releases](https://nodejs.org/en/about/previous-releases)
and [PostgreSQL versioning](https://www.postgresql.org/support/versioning/). A PostgreSQL
major upgrade needs a dump and restore, not just a new image tag.

npm reference: [outdated](https://docs.npmjs.com/cli/v10/commands/npm-outdated) ·
[update](https://docs.npmjs.com/cli/v10/commands/npm-update) ·
[audit](https://docs.npmjs.com/cli/v10/commands/npm-audit)
