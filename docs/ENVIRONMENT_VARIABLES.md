# Complete environment-variable checklist

Kondo validates the production environment when a Vercel production function
starts. A missing, placeholder, unsafe, or mismatched value fails closed.
Secrets belong in Vercel or GitHub settings, never in Git.

## Vercel production runtime

| Variable                    | Required         | Purpose                                                | Obtain it from                                                                                                                               |
| --------------------------- | ---------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | Mandatory        | Prisma runtime database connection                     | Neon → project → Connect → pooled connection string. The hostname must contain `-pooler`, and the URL must include `sslmode=require`.        |
| `DIRECT_URL`                | Mandatory        | Prisma migrations and direct database operations       | Neon → project → Connect → direct connection string. Use the same production branch/database without `-pooler`, including `sslmode=require`. |
| `JWT_SECRET`                | Mandatory secret | Signs sessions and upload claims                       | Generate once with `openssl rand -base64 48`. Use a distinct value per environment.                                                          |
| `NEXT_PUBLIC_APP_URL`       | Mandatory        | Canonical metadata and verification/reset/digest links | The exact public HTTPS origin: `https://www.joinkondo.com`, with no path or trailing slash.                                                  |
| `STORAGE_DRIVER`            | Mandatory        | Selects durable object storage                         | Fixed production value: `s3`.                                                                                                                |
| `STORAGE_BUCKET`            | Mandatory        | Private R2 bucket name                                 | Cloudflare → R2 Object Storage → bucket name.                                                                                                |
| `STORAGE_REGION`            | Mandatory        | AWS SDK region for R2                                  | Fixed value: `auto`.                                                                                                                         |
| `STORAGE_ENDPOINT`          | Mandatory        | R2 S3 API endpoint                                     | Cloudflare R2 overview/token screen: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.                                                        |
| `STORAGE_ACCESS_KEY_ID`     | Mandatory secret | Signs R2 object calls and presigned URLs               | Cloudflare → R2 → Manage R2 API Tokens → create bucket-scoped Object Read & Write token.                                                     |
| `STORAGE_SECRET_ACCESS_KEY` | Mandatory secret | Secret half of the R2 S3 credential                    | Displayed once when the R2 API token is created.                                                                                             |
| `EMAIL_PROVIDER`            | Mandatory        | Enables real email delivery                            | Fixed production value: `resend`.                                                                                                            |
| `RESEND_API_KEY`            | Mandatory secret | Sends verification, reset, and digest email            | Resend → API Keys → create a sending key.                                                                                                    |
| `EMAIL_FROM`                | Mandatory        | Verified sender identity                               | A sender on the Resend-verified domain, for example `Kondo <no-reply@your-domain.com>`.                                                      |
| `UPSTASH_REDIS_REST_URL`    | Mandatory        | Shared serverless rate-limit state                     | Upstash → Redis database → REST API → URL.                                                                                                   |
| `UPSTASH_REDIS_REST_TOKEN`  | Mandatory secret | Authorizes rate-limit reads/writes                     | Upstash → Redis database → REST API → standard read/write token.                                                                             |
| `CRON_SECRET`               | Mandatory secret | Authenticates all scheduled worker calls               | Generate with `openssl rand -hex 32`; use the identical value in Vercel and GitHub Actions.                                                  |

Add these to Vercel for **Production**. Use isolated Neon, R2, Redis, Resend,
JWT, and worker values for Preview if previews need full integration access.
Do not expose production credentials to Preview deployments.

## GitHub scheduled-worker configuration

| Name                 | Kind                        | Required         | Purpose                                    | Value                                       |
| -------------------- | --------------------------- | ---------------- | ------------------------------------------ | ------------------------------------------- |
| `PRODUCTION_APP_URL` | Actions repository variable | Mandatory        | Base URL called by scheduled jobs          | Same exact origin as `NEXT_PUBLIC_APP_URL`. |
| `CRON_SECRET`        | Actions repository secret   | Mandatory secret | Bearer authorization for `/api/internal/*` | Same value as Vercel `CRON_SECRET`.         |

Configure these at GitHub → repository → Settings → Secrets and variables →
Actions. The workflow runs notification processing every five minutes,
marketplace expiry hourly, media cleanup hourly, and digests daily.

## Optional runtime variables

| Variable                       | Required                   | Purpose                                                                                                         |
| ------------------------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `NOTIFICATION_WORKER_SECRET`   | Optional secret            | Separate bearer secret for manual/external notification and digest calls. Generate with `openssl rand -hex 32`. |
| `MARKETPLACE_WORKER_SECRET`    | Optional secret            | Separate bearer secret for manual/external marketplace expiry calls.                                            |
| `MEDIA_WORKER_SECRET`          | Optional secret            | Separate bearer secret for manual/external media cleanup calls.                                                 |
| `KONDO_ALLOW_DESTRUCTIVE_SEED` | Never enable in production | Explicit local/demo database reset opt-in. Production validation rejects `true`.                                |
| `KONDO_DEV_ORIGINS`            | Development only           | Comma-separated origins allowed for Next.js development HMR.                                                    |
| `STORAGE_LOCAL_ROOT`           | Development/test only      | Local media root; defaults to `.data/media`.                                                                    |

Route-specific worker secrets are alternatives for manual callers. The
scheduled workflow needs only `CRON_SECRET`. There is no Cloudflare Worker in
this repository, so no Cloudflare Worker secret is required.

## Test and CI variables

| Variable                     | Required                                  | Purpose                                                                                          |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `TEST_DATABASE_URL`          | Mandatory for shared CI; optional locally | Disposable PostgreSQL database used by Vitest integration tests. Never point this at production. |
| `PLAYWRIGHT_PORT`            | Optional                                  | Local Playwright server port; defaults to `3100`.                                                |
| `PLAYWRIGHT_BASE_URL`        | Optional                                  | Test an already-running deployment instead of the default local URL.                             |
| `PLAYWRIGHT_SKIP_WEB_SERVER` | Optional                                  | Prevent Playwright from starting the application.                                                |
| `PLAYWRIGHT_TEST_EMAIL`      | Optional                                  | Override seeded member login.                                                                    |
| `PLAYWRIGHT_TEST_PASSWORD`   | Optional secret                           | Override seeded member password.                                                                 |
| `PLAYWRIGHT_ADMIN_EMAIL`     | Optional                                  | Override seeded admin login.                                                                     |
| `PLAYWRIGHT_ADMIN_PASSWORD`  | Optional secret                           | Override seeded admin password.                                                                  |

`NODE_ENV`, `VERCEL_ENV`, `NEXT_RUNTIME`, and `CI` are platform-owned flags,
not credentials. Vercel operator values such as `VERCEL_TOKEN`,
`VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` are optional deployment-automation
credentials and must not be supplied to the application runtime.

## OAuth

OAuth is not implemented and is not required for this release. The existing
`OAuthAccount` database model reserves a safe future linking path, but there
are no provider routes, callbacks, or UI. Do not create unused OAuth secrets.

If OAuth is approved later, implement and review account linking first, then
obtain a provider client ID and client secret and register exact Preview and
Production callback URLs.

## `.env.example` parity

The root `.env.example` documents every application-owned environment variable
referenced by the codebase. Platform-owned flags are documented in its header.
GitHub's `PRODUCTION_APP_URL` is an Actions repository variable rather than an
application runtime variable, so it is documented here and intentionally not
placed in `.env.example`.
