# ShiftPilot - Environment Variables

All variables are defined in the `.env` file at the project root.

## Required Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/dbname` |
| `NEXT_PUBLIC_AZURE_AD_CLIENT_ID` | Azure AD application (client) ID. Used for authentication on both client (MSAL) and server (API routes). | `4dfaa859-043b-4e27-...` |
| `NEXT_PUBLIC_AZURE_AD_TENANT_ID` | Azure AD tenant ID. Identifies which Azure AD directory to authenticate against. | `12345678-abcd-...` |
| `NEXT_PUBLIC_AZURE_AD_REDIRECT_URI` | Redirect URI after Azure AD login. Must match the URI configured in the Azure AD app registration. | `https://shiftpilot.lab.sr.bnc.ch/` |
| `NEXT_PUBLIC_URL` | Public URL of the application. Used for CORS, cron calls, and internal API requests. | `https://shiftpilot.lab.sr.bnc.ch` |
| `AZURE_AD_CLIENT_SECRET` | Azure AD client secret (server-side only). Used by the cron sync job to authenticate with Microsoft Graph API via client credentials flow. | `abc123~secret` |
| `NEXT_PUBLIC_CRON_SECRET` | Secret token to secure cron API endpoints (`/api/cron/backup`, `/api/cron/sync-outlook-responses`). Can be any random string. Generate with: `openssl rand -hex 32` | `a1b2c3d4e5...` |

## Optional Variables

| Variable | Description |
|---|---|
| `MICROSOFT_GRAPH_REFRESH_TOKEN` | Optional refresh token for Microsoft Graph API. If set, the Outlook sync cron uses this instead of client credentials. Not required — the cron falls back to `AZURE_AD_CLIENT_SECRET` automatically. |

## Notes

- Variables prefixed with `NEXT_PUBLIC_` are accessible both server-side and client-side (exposed in the browser JS bundle). This is a Next.js convention.
- `AZURE_AD_CLIENT_SECRET` does NOT have the `NEXT_PUBLIC_` prefix because it is a secret that must never be exposed to the browser.
- The `.env` file is in `.gitignore` and is never committed to the repository.
- On deployment, create a `.env` file on the server with all required variables before running `docker compose up`.
