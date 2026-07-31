# Production readiness review

Reviewed on 2026-07-20 against Modules 0–20 and the production deployment at
`https://www.joinkondo.com`.

## Release status

Kondo is a production release candidate. The codebase, database history,
deployment configuration, integrations, API surface, product pages, Admin
CMS, and critical browser journeys have been reviewed. All defects found that
can be fixed without provider credentials are resolved. Remaining work is
limited to entering production credentials, applying provider configuration,
running migrations, and completing the documented post-deploy smoke test.

The additive identity/organization foundation requires
`20260730090000_identity_organization_foundation` to be applied through the
direct Neon URL before deploying the corresponding application code. It
preserves existing users, sessions, journey enum values, community
memberships, and media. It introduces no new provider credential. Deploy the
migration before the application so organization queries never run against an
older schema.

Professional organization workspaces additionally require
`20260730150000_organization_professional_workspace_enums` followed by
`20260730151000_organization_professional_workspace`. The enum additions are
intentionally committed in their own migration because PostgreSQL cannot safely
use a newly added enum value in the same transaction. The second migration is
additive, explicitly maps legacy organization roles to Editor/Viewer, and
preserves users, sessions, organizations, memberships, media, verification
history, and all unrelated product data. No new environment variable is
introduced.

Kondo Housing additionally requires the additive
`20260731100000_housing_domain_enums` and
`20260731101000_housing_domain` migrations. They add the dedicated Housing,
request, roommate, inquiry and saved-listing records, constrained publisher
ownership, privacy-safe coordinates, indexed public search, Housing
notifications, and no destructive data conversion. Existing Marketplace
Housing rows remain readable but are not silently migrated.

### Resolved release findings

1. **Production upload failure:** a real Home-feed upload reached the
   authenticated upload-intent route but its direct browser `PUT` failed with
   `Failed to fetch`. The live R2 bucket is missing, or does not exactly match,
   the required browser CORS origin. The exact policy is documented below.
2. **R2 signing defect:** recent AWS SDK versions added an empty-body CRC32 to
   presigned browser `PUT` URLs. The S3 client now requests checksums only when
   required; regression coverage proves upload URLs contain no automatic CRC32
   parameters.
3. **Large media delivery:** images up to 8 MB and PDFs up to 10 MB were being
   proxied through a Vercel function with a 4.5 MB body limit. Kondo now
   authorizes the read and redirects to a 60-second signed R2 `GET`.
4. **Vercel deployment failure:** sub-daily entries were removed from
   `vercel.json` because Vercel Hobby rejects them. GitHub Actions now invokes
   the same secret-gated workers every five minutes/hour/day.
5. **Unsafe production configuration:** production functions now fail closed
   when database, canonical URL, R2, Resend, Upstash, JWT, or scheduler values
   are missing, placeholders, malformed, weak, or inconsistent.
6. **Authentication hardening:** login now performs bcrypt work for unknown
   accounts, password-reset requests use generic bounded-duration responses,
   reset tokens are claimed atomically, and valid-token checks precede bcrypt
   to prevent invalid-token CPU abuse.
7. **Request hardening:** state-changing production routes reject missing,
   cross-host, and cross-scheme origins. Every one of the 97 API routes was
   statically audited for origin/worker gates and JSON validation.
8. **Repository/release hygiene:** generated local media, editor metadata, and
   `.DS_Store` files were removed from source control; formatting is enforced;
   Node.js 24 LTS is pinned; CI, CodeQL, and Dependabot configuration are
   committed.
9. **UI data correctness:** the Home feed no longer shows a hard-coded date,
   time, weather, or air-quality reading.

### Accepted upstream/operational items

- `npm audit` reports two moderate findings from Next.js's internal
  `postcss@8.4.31`. Next.js 16.2.10 is currently the latest package release and
  still pins that version. Overriding it creates an invalid dependency tree;
  npm's proposed framework downgrade is unsafe. CI rejects high/critical
  findings and Dependabot tracks the upstream stable fix.
- Media “scanning” currently verifies size, extension, MIME signature,
  decodability, dimensions, and basic unsafe-PDF markers. It is not a full
  antivirus service. Add managed malware scanning if the threat model requires
  accepting documents from untrusted users at scale.
- Structured server logging exists, but no external error tracker, uptime
  monitor, or alert destination can be configured without selecting and
  provisioning an operations provider.

## Upload pipeline verification

The common pipeline is:

1. The browser requests an authenticated upload intent from
   `POST /api/media/uploads`.
2. The server validates purpose, extension, declared MIME, size, alt text, and
   replacement ownership; creates a pending `MediaAsset`; then returns a
   ten-minute presigned `PUT`.
3. The browser uploads bytes directly to local storage in development or R2 in
   production.
4. The browser calls `POST /api/media/uploads/:id/complete`.
5. The server performs `HEAD` and `GET`, verifies exact size and content type,
   detects the real MIME type, fully decodes images, checks dimensions/PDF
   safety, computes SHA-256, and marks the asset active and clean.
6. The domain write transaction attaches only an owned, active, clean asset of
   the expected purpose.
7. Reads pass through `GET /api/media/:id` for visibility/participant/admin
   authorization, then local bytes are streamed in development or a 60-second
   R2 `GET` URL is returned in production.

| Surface                | Purpose                  | Status                                                    |
| ---------------------- | ------------------------ | --------------------------------------------------------- |
| Home-feed posts        | `POST_IMAGE`             | Uses the corrected shared pipeline                        |
| Community posts        | `POST_IMAGE`             | Same `PostComposer` and pipeline as Home                  |
| Community covers       | `COMMUNITY_COVER`        | Uses the corrected shared pipeline                        |
| Marketplace listings   | `LISTING_IMAGE`          | Uses the corrected shared pipeline                        |
| Housing listing images | `HOUSING_LISTING_IMAGE`  | Public only through an eligible published Housing listing |
| Housing floor plans    | `HOUSING_FLOOR_PLAN`     | Uses the same listing visibility boundary                 |
| Housing proof files    | `HOUSING_PROOF_DOCUMENT` | Private publisher/Admin-review delivery only              |
| Profile avatars        | `PROFILE_AVATAR`         | Moved to the corrected shared pipeline                    |
| Message images         | `MESSAGE_IMAGE`          | Moved to the corrected shared pipeline                    |
| Message PDFs           | `MESSAGE_DOCUMENT`       | Moved to the corrected shared pipeline                    |
| Student Hub documents  | Not applicable           | No Student Hub document-upload surface exists             |

`GUIDE_COVER` now uses the same validated two-phase upload pipeline. Admin guide
create/edit forms support upload, preview, replacement, and removal through the
relational `Guide.coverMediaId`; legacy `coverImageKey` is not exposed.

The corrected local pipeline was exercised through the real Home UI: intent,
local `PUT`, completion/validation, post attachment, optimized image render
with non-zero natural dimensions, and cleanup all succeeded. The latest full
quality gate passed on Node.js 24 with 44 Vitest files/232 tests, a production
Next.js build generating 56 static pages plus all dynamic routes, and 22
Playwright journeys. The disposable PostgreSQL database is current through all
25 migrations. Every Admin CMS index was exercised by Playwright. Real R2
verification remains blocked until the credentials and CORS configuration are
supplied.

## Required R2 configuration

Create a **private** R2 bucket. Disable the `r2.dev` public URL and do not make
the bucket public. Create a bucket-scoped R2 S3 token with **Object Read &
Write** permission; Kondo needs `PutObject`, `HeadObject`, `GetObject`, and
`DeleteObject`.

Apply this production CORS policy, replacing the origin if a custom domain will
be canonical:

```json
[
  {
    "AllowedOrigins": ["https://www.joinkondo.com"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Type",
      "Content-Disposition"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

If development will exercise the real R2 bucket instead of local storage, add
a separate rule for the exact local origin, such as
`http://localhost:3000` or `http://localhost:3100`. Add a fixed preview origin
as a separate exact origin if preview deployments must upload. Avoid `*` for
authenticated user media.

Cloudflare documents both
[browser CORS for presigned URLs](https://developers.cloudflare.com/r2/buckets/cors/)
and [presigned R2 `GET`/`PUT` operations](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

## Credentials and configuration checklist

Do not paste secrets into Git, issues, chat messages, or `.env.example`. Supply
them through the relevant provider's secret-sharing mechanism or add them
directly to Vercel.

### 1. Vercel

| Item                                    | Why                                                                                                          | Where to obtain                                                                                                     | Requirement                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Vercel project/team access              | Import GitHub, set production values, inspect deployments, and smoke test                                    | Vercel team → Settings → Members                                                                                    | Mandatory for configuration                    |
| `NEXT_PUBLIC_APP_URL`                   | Canonical metadata and all email links                                                                       | The chosen production HTTPS origin/domain                                                                           | Mandatory runtime variable                     |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`       | Google Maps JavaScript rendering and public study-area geocoding for privacy-safe Meet and Housing discovery | Browser key restricted to Maps JavaScript API, Geocoding API, Kondo Production, and approved Preview HTTP referrers | Optional public; explicit fallback when absent |
| `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` | Browser-visible VAPID key used when a member enables push notifications                                      | Generate one VAPID pair with `npx web-push generate-vapid-keys`                                                     | Optional public; required for Web Push         |
| `WEB_PUSH_VAPID_PRIVATE_KEY`            | Signs Web Push payloads on the server                                                                        | Private key from the same generated VAPID pair                                                                      | Optional secret; required for Web Push         |
| `WEB_PUSH_SUBJECT`                      | Identifies the push sender to browser push services                                                          | A monitored `mailto:` address or an HTTPS contact URL                                                               | Optional; required for Web Push                |
| Node.js 24                              | Supported LTS runtime pinned by `package.json`                                                               | Vercel project → Settings → Build and Deployment                                                                    | Mandatory; selected automatically              |
| `VERCEL_TOKEN`                          | CLI/API automation without interactive dashboard access                                                      | Vercel Account Settings → Tokens                                                                                    | Optional; operator credential, not app runtime |
| `VERCEL_ORG_ID`                         | Identifies the owning Vercel team for CLI/CI                                                                 | Project `.vercel/project.json` after linking, or Vercel project settings                                            | Optional; required with token-based automation |
| `VERCEL_PROJECT_ID`                     | Identifies this Vercel project for CLI/CI                                                                    | Project `.vercel/project.json` after linking, or Vercel project settings                                            | Optional; required with token-based automation |
| Production domain/DNS access            | Configure the canonical domain, R2 CORS origin, and Resend DNS records                                       | Domain registrar/DNS provider                                                                                       | Mandatory if replacing the `vercel.app` domain |

Vercel applies environment changes only to new deployments, so redeploy after
the final values are set.

The existing GitHub Actions production-worker workflow calls
`/api/internal/housing/expire` hourly with `CRON_SECRET`. A separate scheduler
may use `HOUSING_WORKER_SECRET`; both values are server-only and the endpoint
fails closed when neither bearer secret matches.

Web Push is enabled only when all three VAPID variables are configured together.
The private key must remain server-only. Without them, the notification center
and foreground in-app banners continue to work, while browser push is reported
as unconfigured instead of failing the application.

### 2. Neon PostgreSQL

| Variable            | Why                                                                        | Where to obtain                                                        | Requirement                                |
| ------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------ |
| `DATABASE_URL`      | Prisma runtime queries from serverless functions                           | Neon project → Connect → pooled connection string (`-pooler` hostname) | Mandatory                                  |
| `DIRECT_URL`        | Controlled `prisma migrate deploy`, introspection, backup tools            | Neon project → Connect → direct connection string                      | Mandatory                                  |
| `TEST_DATABASE_URL` | Migration-backed Vitest/integration suite without touching production data | A separate disposable Neon branch/database and role                    | Mandatory for CI; never production runtime |

Use separate production, preview, and test branches/databases. Confirm backups
or point-in-time restore, connection limits, and the production migration
status before cutover. Neon recommends a
[direct connection for ORM migrations](https://neon.com/docs/connect/connection-pooling).

### 3. Cloudflare R2

| Variable/configuration                | Why                                                                      | Where to obtain                                                                          | Requirement           |
| ------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | --------------------- |
| `STORAGE_DRIVER=s3`                   | Selects durable production storage; local is rejected in production      | Fixed value                                                                              | Mandatory             |
| `STORAGE_BUCKET`                      | Names the private media bucket                                           | Cloudflare dashboard → R2 Object Storage                                                 | Mandatory             |
| `STORAGE_REGION=auto`                 | Region value required by the S3 SDK for R2                               | Fixed R2 value                                                                           | Mandatory             |
| `STORAGE_ENDPOINT`                    | R2 S3 API endpoint                                                       | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`; shown in R2 Overview/token confirmation | Mandatory             |
| `STORAGE_ACCESS_KEY_ID`               | Signs private object operations and presigned URLs                       | R2 → Manage R2 API Tokens → bucket-scoped Object Read & Write token                      | Mandatory secret      |
| `STORAGE_SECRET_ACCESS_KEY`           | Secret half of the S3 credentials                                        | Shown once when the R2 token is created                                                  | Mandatory secret      |
| Private bucket/public access disabled | Kondo enforces visibility and participant authorization                  | R2 bucket settings                                                                       | Mandatory             |
| Exact CORS policy above               | Allows browser `PUT` and short-lived browser `GET` from approved origins | R2 bucket → Settings → CORS policy                                                       | Mandatory             |
| `STORAGE_LOCAL_ROOT`                  | Filesystem location for the local driver                                 | Chosen local path; default `.data/media`                                                 | Development/test only |

The R2 token must be an S3 credential pair, not a Cloudflare REST API bearer
token.

### 4. Upstash Redis

| Variable                   | Why                                             | Where to obtain                                           | Requirement                                   |
| -------------------------- | ----------------------------------------------- | --------------------------------------------------------- | --------------------------------------------- |
| `UPSTASH_REDIS_REST_URL`   | Shared rate-limit state across Vercel instances | Upstash Console → Redis database → REST API               | Mandatory for production-grade limits         |
| `UPSTASH_REDIS_REST_TOKEN` | Authorizes read/write rate-limit operations     | Same REST API panel; use the standard/write-capable token | Mandatory for production-grade limits; secret |

Both must be present together. The code otherwise falls back to process-local
memory. See Upstash's
[REST API credential instructions](https://upstash.com/docs/redis/features/restapi).

### 5. Resend

| Variable/configuration                  | Why                                                              | Where to obtain                                                          | Requirement             |
| --------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------- |
| `EMAIL_PROVIDER=resend`                 | Selects real delivery instead of the local no-op provider        | Fixed value                                                              | Mandatory in production |
| `RESEND_API_KEY`                        | Sends verification, reset, and digest email                      | Resend dashboard → API Keys; sending access is sufficient                | Mandatory secret        |
| `EMAIL_FROM`                            | Sender name/address used by Kondo                                | Address on a Resend-verified domain, e.g. `Kondo <no-reply@example.com>` | Mandatory               |
| Verified sending domain and DNS records | Resend rejects general-recipient sending from unverified domains | Resend dashboard → Domains, then the DNS provider                        | Mandatory               |

Resend's setup is: verify a domain, then
[create an API key and send from that domain](https://resend.com/docs/knowledge-base/how-do-I-create-an-email-address-or-sender-in-resend).

### 6. OAuth

OAuth is not implemented in the current codebase. The Prisma
`OAuthAccount` model alone does not provide routes, account linking, callback
validation, or provider UI. No OAuth variable belongs in the production
environment today, and OAuth is not a go-live requirement.

If Google sign-in is approved as a future feature, it will require a reviewed
implementation plus a Google OAuth client ID, client secret, consent-screen
configuration, and exact preview/production redirect URIs. Do not provide or
configure those unused credentials now.

### 7. `JWT_SECRET`

| Variable     | Why                                                             | Where to obtain                                                                        | Requirement      |
| ------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------- |
| `JWT_SECRET` | Signs session cookies and derives media-upload token signatures | Generate independently with `openssl rand -base64 48` and store in Vercel as sensitive | Mandatory secret |

Use one stable production value with at least 32 random bytes. Rotation signs
all users out and invalidates outstanding media-upload intents.

### 8. `CRON_SECRET`

| Variable      | Why                                                       | Where to obtain                                                                | Requirement      |
| ------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------- |
| `CRON_SECRET` | Authenticates GitHub scheduled calls to `/api/internal/*` | Generate with `openssl rand -hex 32`; add to Vercel and GitHub Actions secrets | Mandatory secret |

Do not reuse `JWT_SECRET`. GitHub also needs repository variable
`PRODUCTION_APP_URL`, set to the same origin as `NEXT_PUBLIC_APP_URL`.

### 9. Worker secrets

| Variable                     | Routes                                     | Requirement                                      |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------ |
| `NOTIFICATION_WORKER_SECRET` | Notification process and digest            | Optional alternative for separate manual callers |
| `MARKETPLACE_WORKER_SECRET`  | Listing expiry                             | Optional alternative for separate manual callers |
| `MEDIA_WORKER_SECRET`        | Orphan cleanup and provider-delete retries | Optional alternative for separate manual callers |

Generate each independently with `openssl rand -hex 32`. There is no
Cloudflare Worker in this repository and therefore no additional Cloudflare
Worker secret.

### 10. Additional variables

| Variable                                               | Requirement                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| `KONDO_ALLOW_DESTRUCTIVE_SEED`                         | Local/demo reset only. Leave unset or `false` in production.         |
| `KONDO_DEV_ORIGINS`                                    | Optional development-only comma-separated Next.js HMR origins.       |
| `PLAYWRIGHT_PORT`                                      | Optional CI/local E2E server port; defaults to `3100`.               |
| `PLAYWRIGHT_BASE_URL`                                  | Optional when testing an already deployed preview/production origin. |
| `PLAYWRIGHT_SKIP_WEB_SERVER`                           | Optional truthy flag when Playwright should not start Kondo.         |
| `PLAYWRIGHT_TEST_EMAIL` / `PLAYWRIGHT_TEST_PASSWORD`   | Optional E2E member account override.                                |
| `PLAYWRIGHT_ADMIN_EMAIL` / `PLAYWRIGHT_ADMIN_PASSWORD` | Optional E2E admin account override.                                 |
| `NODE_ENV`, `VERCEL_ENV`, `CI`                         | Platform-owned flags; do not add them as Kondo secrets.              |

No additional analytics, OAuth, CAPTCHA, payment, Cloudflare Worker, or error
tracking variable is referenced by the current code.

## Environment-file parity

The root `.env.example` matches all application-owned variables referenced by
the codebase. `NODE_ENV`, `VERCEL_ENV`, `NEXT_RUNTIME`, and `CI` are
platform-owned and documented in the file header. GitHub
`PRODUCTION_APP_URL` and operator credentials such as `VERCEL_TOKEN` are
intentionally excluded because they are not application runtime variables.

## Part 3 public organization release checks

Migration `20260730200000_organization_public_profiles` is additive. It keeps
all existing organizations private, backfills representation confirmation only
for completed setups, normalizes existing professional contacts using their
current audience, adds ordered gallery/contact relations, adds publication and
moderation fields/indexes, and adds the generated public-field search vector.
It does not publish existing records, delete legacy fields, mutate City Hub
snapshots, or convert ScholarshipAgent/Community data.

Before deployment:

1. Review the migration SQL and run `prisma migrate status` against the
   intended direct database URL.
2. Verify private/ready/unpublished/suspended/archived organizations return the
   same safe not-found response on public routes and cannot enter Search,
   directory, Explore, metadata, or sitemap output.
3. Verify Owner/Admin publication and unpublication, Editor media editing, and
   Viewer denial.
4. Verify Admin correction, unpublish, and restriction-lift permissions,
   AuditLog records, notification jobs, and cache invalidation.
5. Verify old-slug permanent redirects and canonical metadata.
6. Run the organization unit, PostgreSQL integration, and Playwright journeys
   against a production build.

Provider-dependent deployed smoke checks:

- upload and deliver a public logo, cover, and gallery image through R2;
- confirm a private verification document remains unavailable;
- load the public Open Graph image and canonical metadata;
- search and filter a published profile, including from its city;
- unpublish and suspend the profile, then confirm immediate removal from every
  public surface;
- verify mobile hero, horizontal section navigation, gallery keyboard controls,
  contact dialog focus behavior, light/dark contrast, and reduced motion;
- process an Admin moderation notification through the configured worker.

No new environment variable is introduced by Part 3.

## Final release gate

After credentials are supplied, follow
[`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md):

1. Inspect/configure separate Vercel Production and Preview values.
2. Apply and verify the exact R2 bucket policy and CORS rules.
3. Test S3 `PUT`, `HEAD`, `GET`, and `DELETE` with a disposable object.
4. Run `npx prisma migrate status`, back up production, and run
   `npx prisma migrate deploy` through `DIRECT_URL`.
5. Run `npm ci`, lint, type checking, Vitest, build, and Playwright.
6. Deploy to Preview and exercise Home/community posts, community covers,
   marketplace images, avatar replacement, message image/PDF delivery, rejected
   files, and cleanup.
7. Deploy the same reviewed commit to Production.
8. Verify `/api/health`, email delivery, Redis-backed rate limits, every cron
   route, production metadata, image rendering, private-media authorization,
   logs, alerts, and rollback.

## Part 5 opportunities release checks

Runtime checks that still require a deployed environment:

- public opportunity pages and `/opportunities` search;
- organization-page and Student Hub projections against real published data;
- R2 delivery for public opportunity cover media;
- private application-document upload and authorized delivery
  (`/api/opportunities/documents/[documentId]/download`);
- external application redirect behaviour and blocked-source suppression;
- application notification delivery and deadline reminders;
- cache invalidation after opportunity removal and organization suspension;
- the mobile application flow end to end.

New environment variable: `OPPORTUNITY_WORKER_SECRET`, the shared secret for
`POST /api/internal/opportunities/expire`. The expiry sweep is also available as
`npm run opportunities:expire`. No other configuration changes.
