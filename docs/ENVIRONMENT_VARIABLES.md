# Complete environment-variable checklist

Kondo validates the production environment when a Vercel production function
starts. A missing mandatory value, placeholder, unsafe, or mismatched value
fails closed. Optional provider integrations use an explicit unavailable state.
Secrets belong in Vercel or GitHub settings, never in Git.

The Personal/Organization registration split and professional organization
workspaces introduce no new provider secret. They reuse database sessions,
PostgreSQL/Neon, R2 media, notification, analytics, and security configuration.
Organization invitations use `NEXT_PUBLIC_APP_URL` for links and the existing
Resend settings for delivery; verification documents use the existing private
R2 pipeline.

## Vercel production runtime

| Variable                    | Required         | Purpose                                                     | Obtain it from                                                                                                                               |
| --------------------------- | ---------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | Mandatory        | Prisma runtime database connection                          | Neon → project → Connect → pooled connection string. The hostname must contain `-pooler`, and the URL must include `sslmode=require`.        |
| `DIRECT_URL`                | Mandatory        | Prisma migrations and direct database operations            | Neon → project → Connect → direct connection string. Use the same production branch/database without `-pooler`, including `sslmode=require`. |
| `JWT_SECRET`                | Mandatory secret | Signs sessions and upload claims                            | Generate once with `openssl rand -base64 48`. Use a distinct value per environment.                                                          |
| `NEXT_PUBLIC_APP_URL`       | Mandatory        | Canonical metadata and verification/reset/digest links      | The exact public HTTPS origin: `https://www.joinkondo.com`, with no path or trailing slash.                                                  |
| `STORAGE_DRIVER`            | Mandatory        | Selects durable object storage                              | Fixed production value: `s3`.                                                                                                                |
| `STORAGE_BUCKET`            | Mandatory        | Private R2 bucket name                                      | Cloudflare → R2 Object Storage → bucket name.                                                                                                |
| `STORAGE_REGION`            | Mandatory        | AWS SDK region for R2                                       | Fixed value: `auto`.                                                                                                                         |
| `STORAGE_ENDPOINT`          | Mandatory        | R2 S3 API endpoint                                          | Cloudflare R2 overview/token screen: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.                                                        |
| `STORAGE_ACCESS_KEY_ID`     | Mandatory secret | Signs R2 object calls and presigned URLs                    | Cloudflare → R2 → Manage R2 API Tokens → create bucket-scoped Object Read & Write token.                                                     |
| `STORAGE_SECRET_ACCESS_KEY` | Mandatory secret | Secret half of the R2 S3 credential                         | Displayed once when the R2 API token is created.                                                                                             |
| `EMAIL_PROVIDER`            | Mandatory        | Enables real email delivery                                 | Fixed production value: `resend`.                                                                                                            |
| `RESEND_API_KEY`            | Mandatory secret | Sends verification, reset, and digest email                 | Resend → API Keys → create a sending key.                                                                                                    |
| `EMAIL_FROM`                | Mandatory        | Verified sender identity                                    | A sender on the Resend-verified domain, for example `Kondo <no-reply@your-domain.com>`.                                                      |
| `UPSTASH_REDIS_REST_URL`    | Mandatory        | Shared serverless rate-limit state                          | Upstash → Redis database → REST API → URL.                                                                                                   |
| `UPSTASH_REDIS_REST_TOKEN`  | Mandatory secret | Authorizes rate-limit reads/writes                          | Upstash → Redis database → REST API → standard read/write token.                                                                             |
| `CRON_SECRET`               | Mandatory secret | Authenticates all scheduled worker calls                    | Generate with `openssl rand -hex 32`; use the identical value in Vercel and GitHub Actions.                                                  |
| `ANTHROPIC_API_KEY`         | Optional secret  | Server-side Kondo study assistant in the Study Essentials reader (explain / summarize / revision questions / notes) | Anthropic Console → API keys. Server-only; never exposed to the browser. When unset the assistant is offered as unavailable and highlights, notes and tasks keep working. |
| `DEEPSEEK_API_KEY`          | Mandatory secret | Server-side timetable structuring after PDF/image OCR       | DeepSeek Platform → API keys. Keep server-only and scope it to the production project.                                                       |
| `LIVEKIT_URL`               | Mandatory        | LiveKit Cloud WebSocket endpoint for Meet and private calls | LiveKit Cloud → Project settings → Project URL; expected format `wss://<project>.livekit.cloud`.                                             |
| `LIVEKIT_API_KEY`           | Mandatory secret | Server-side participant token signing                       | LiveKit Cloud → Project settings → Keys. Never expose it with a `NEXT_PUBLIC_` prefix.                                                       |
| `LIVEKIT_API_SECRET`        | Mandatory secret | Server-side participant token signing                       | LiveKit Cloud → Project settings → Keys. Store only in Vercel Production/Preview secrets.                                                    |

Add these to Vercel for **Production**. Use isolated Neon, R2, Redis, Resend,
JWT, and worker values for Preview if previews need full integration access.

For `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, enable billing plus the **Maps JavaScript
API** and **Geocoding API** in the same Google Cloud project. Restrict the key
to websites and allow only the origins that are actually used, for example
`https://www.joinkondo.com/*`, `https://joinkondo.com/*`, approved
`https://<deployment>.vercel.app/*` Preview URLs, and `http://localhost:3000/*`
for local development. Apply API restrictions to those two APIs. Environment
changes require a fresh Vercel deployment.
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

| Variable                                | Required                   | Purpose                                                                                                                                        |
| --------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `NOTIFICATION_WORKER_SECRET`            | Optional secret            | Separate bearer secret for manual/external notification and digest calls. Generate with `openssl rand -hex 32`.                                |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`       | Optional public            | Enables Google Maps and public study-area geocoding for Meet and Housing. Without it, Kondo renders the documented privacy-safe map fallback.  |
| `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` | Optional public            | VAPID public key offered to the browser when a member enables push on a device. Generate with `npx web-push generate-vapid-keys`.              |
| `WEB_PUSH_VAPID_PRIVATE_KEY`            | Optional secret            | Private half of the same VAPID pair, used server-side to sign push payloads. Never expose it with a `NEXT_PUBLIC_` prefix.                     |
| `WEB_PUSH_SUBJECT`                      | Optional                   | Contact identity sent to push services, as `mailto:` or an https URL. Required alongside the VAPID pair.                                       |
| `MARKETPLACE_WORKER_SECRET`             | Optional secret            | Separate bearer secret for manual/external marketplace expiry calls.                                                                           |
| `HOUSING_WORKER_SECRET`                 | Optional secret            | Separate bearer secret for Housing listing and request expiry calls. Generate with `openssl rand -hex 32`.                                     |
| `MEDIA_WORKER_SECRET`                   | Optional secret            | Separate bearer secret for manual/external media cleanup calls.                                                                                |
| `KONDO_ALLOW_DESTRUCTIVE_SEED`          | Never enable in production | Explicit local/demo database reset opt-in. Production validation rejects `true`.                                                               |
| `KONDO_E2E`                             | Playwright only            | Test-only switch for local media uploads against Playwright's production-built server. Production validation rejects it and Vercel ignores it. |
| `KONDO_DEV_ORIGINS`                     | Development only           | Comma-separated origins allowed for Next.js development HMR.                                                                                   |
| `STORAGE_LOCAL_ROOT`                    | Development/test only      | Local media root; defaults to `.data/media`.                                                                                                   |
| `SCHEDULE_AI_PROVIDER`                  | Optional                   | Timetable provider adapter; currently `deepseek` (default).                                                                                    |
| `SCHEDULE_AI_MODEL`                     | Legacy/ignored             | Timetable extraction uses `deepseek-v4-flash` for predictable low-latency JSON. Remove older `deepseek-v4-pro` overrides.                      |
| `SCHEDULE_AI_TIMEOUT_MS`                | Optional                   | Provider timeout in milliseconds, clamped from 20,000 to 120,000; default 75,000.                                                              |

Route-specific worker secrets are alternatives for manual callers. The
scheduled workflow needs only `CRON_SECRET`. There is no Cloudflare Worker in
this repository, so no Cloudflare Worker secret is required.

To activate Web Push, run `npx web-push generate-vapid-keys` once and configure
the public key, private key, and subject together. Use the same pair across
Production redeployments so existing browser subscriptions remain valid. The
private key is server-only; never expose it through a `NEXT_PUBLIC_` variable.
Without this optional trio, foreground banners and the notification center
remain available, but the settings screen reports browser push as unconfigured.

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

## Public Organization profiles

Public Organization profiles, the directory, Search projection, Explore city
rail, reporting, and Admin publication moderation introduce no new runtime
variable. They reuse `DATABASE_URL`/`DIRECT_URL`, the existing private media
provider configuration, notification worker configuration, and
`NEXT_PUBLIC_APP_URL` for canonical public URLs. Do not add a separate public
bucket or expose R2 credentials to the browser.

## OPPORTUNITY_WORKER_SECRET

Shared secret for the opportunity deadline-expiry worker route
`POST /api/internal/opportunities/expire` and the opt-in reminder worker route
`POST /api/internal/opportunities/reminders`. Optional: when unset the routes
refuses every request and the sweep can still be run manually with
`npm run opportunities:expire` or `npm run opportunities:reminders`. Mirrors `HOUSING_WORKER_SECRET` and
`MARKETPLACE_WORKER_SECRET`.

## Part 8 provider-disabled payment state

There is deliberately no payment-provider environment variable in the current
release. Adding a token or URL ad hoc must not enable payments. A future provider
requires a reviewed adapter, additive migration, webhook verification,
reconciliation and an update to this document. Until then
`paymentCapability.enabled` remains false and supported currencies/use cases
remain empty.

Operational audit commands:

- `npm run release:audit -- --summary` requires no credentials and validates
  route/access/analytics structure.
- `npm run legacy:audit` requires `DATABASE_URL`/`DIRECT_URL`, performs only
  read queries and prints no User PII.
- integration tests require a URL whose database name includes
  `kondo_module3_test`; otherwise database suites intentionally skip.

See [`PAYMENTS_AND_BILLING.md`](./PAYMENTS_AND_BILLING.md) and
[`PART8_RELEASE_AUDIT.md`](./PART8_RELEASE_AUDIT.md).
