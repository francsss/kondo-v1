# Kondo Deployment

## Target architecture

- Application: Vercel, Node.js 24 LTS, Next.js App Router.
- Database: Neon PostgreSQL with pooled runtime and direct migration URLs.
- Media: private Cloudflare R2 through its S3-compatible API.
- Shared limits: Upstash Redis REST.
- Transactional email: Resend with a verified sending domain.
- Recurring workers: GitHub Actions calling secret-gated Vercel routes.

## Required environment variables

The authoritative, service-by-service list is
[`docs/ENVIRONMENT_VARIABLES.md`](./ENVIRONMENT_VARIABLES.md). Production
startup validates every mandatory runtime value, requires Neon pooled/direct
URL shapes, rejects local storage and console email, checks credential
strength, and refuses placeholder values.

## Vercel release process

1. Complete [`docs/DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md).
2. Configure isolated Preview and Production services; never upload a local
   `.env` or expose production credentials to Preview.
3. Let GitHub Release checks verify formatting, lint, types, unit/integration
   tests, the production build, Playwright journeys, and dependency severity.
4. Back up production and apply reviewed migrations with
   `npx prisma migrate deploy` through `DIRECT_URL`.
5. Deploy the exact green `main` commit to Vercel.
6. Run the product, Admin, upload, email, rate-limit, and worker smoke tests
   from the checklist, then monitor the release.

The Admin architecture, routes, permissions, first-operator bootstrap, and CMS
workflows are documented in [`docs/ADMIN.md`](./ADMIN.md).

Do not run the demo seed in production. The seed refuses `NODE_ENV=production` and `VERCEL_ENV=production` unconditionally, and non-production runs still require the one-command opt-in `KONDO_ALLOW_DESTRUCTIVE_SEED=true`.

Release 0.13.0 requires all three community migrations before serving the new UI. Back up production, confirm every existing community has a valid `createdById`, and deploy migrations before the application build. The migration normalizes the creator as owner, marks existing published events validated, and aborts rather than accepting broken foreign-key or owner state.

## Scheduled jobs (cron)

Background work runs through authenticated internal HTTP routes scheduled by
`.github/workflows/scheduled-workers.yml`. GitHub sends
`Authorization: Bearer <CRON_SECRET>` over `POST`; each route also accepts its
route-specific worker secret and remains compatible with Vercel Cron `GET`.

| Route                                 | GitHub schedule    | Purpose                                              | Secrets accepted                              |
| ------------------------------------- | ------------------ | ---------------------------------------------------- | --------------------------------------------- |
| `/api/internal/notifications/process` | Every five minutes | Drains the notification outbox.                      | `CRON_SECRET` or `NOTIFICATION_WORKER_SECRET` |
| `/api/internal/notifications/digest`  | Daily, 08:13 UTC   | Sends due email digests.                             | `CRON_SECRET` or `NOTIFICATION_WORKER_SECRET` |
| `/api/internal/stories/publish`       | Every five minutes | Publishes due scheduled Student Stories.             | `CRON_SECRET`                                 |
| `/api/internal/marketplace/expire`    | Hourly, minute 17  | Expires stale marketplace listings.                  | `CRON_SECRET` or `MARKETPLACE_WORKER_SECRET`  |
| `/api/internal/media/cleanup`         | Hourly, minute 37  | Deletes orphaned media and retries provider deletes. | `CRON_SECRET` or `MEDIA_WORKER_SECRET`        |

- Set the same `CRON_SECRET` in Vercel Production and GitHub Actions secrets.
- Set GitHub Actions variable `PRODUCTION_APP_URL` to the canonical origin.
- Scheduling outside `vercel.json` keeps Vercel Hobby deployments valid; Hobby
  rejects cron expressions that run more than once per day.
- The equivalent CLI scripts call the same library functions directly and remain available for local runs and non-Vercel hosts.

## Health check

`GET /api/health` is an unauthenticated readiness probe: it performs a trivial database round-trip and returns `{"status":"ok"}` (200) or `{"status":"degraded"}` (503). Use it for uptime monitoring and post-deploy smoke tests. It exposes no build, version, or schema detail.

## Go-live runbook

Follow [`docs/DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) from service
provisioning through smoke tests and rollback preparation. It is the release
runbook and includes first-Super-Admin bootstrap.

## Local-network testing

Start the development server on all interfaces:

```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Use `http://localhost:3000` on the Mac and the Mac's private address, such as `http://192.168.31.49:3000`, on devices connected to the same trusted Wi-Fi. The session cookie remains host-only. It omits `Secure` for these HTTP origins and enables `Secure` only when the production request is effectively HTTPS. `NEXT_PUBLIC_APP_URL` controls canonical metadata and does not control session-cookie scope or authentication redirects.

Kondo's development config allows Next.js client and HMR resources from `192.168.*.*`. If the Mac uses another private range, set a comma-separated development-only pattern through `KONDO_DEV_ORIGINS`. Do not add broad public-domain patterns. Vercel production does not use this development allowlist.

## Database migration policy

- Prefer additive changes first; backfill separately; remove old fields only after the application no longer reads them.
- Review generated SQL before deployment.
- Back up production before a destructive migration.
- Use `prisma migrate deploy` in production, never `db push`.
- Record schema changes and operator notes in `docs/CHANGELOG.md` and `docs/DATABASE.md`.

Release 0.5.0 migration `20260716090000_operational_moderation` is additive. Before creating the active-conversation-report partial unique index, it preserves historical rows and closes extra active duplicate conversation cases as `DISMISSED/DUPLICATE`. It backfills required terminal decision/resolution timestamps and converts any legacy resolution text attached to an active report into an internal note before enabling the lifecycle check. Back up production and review the affected-row counts before deployment.

Release 0.5.1 has no database migration. Deploy it only after the existing three migrations are current.

Release 0.6.0 requires migration `20260716110000_reference_data_onboarding`. Before deployment, review the counts of University country corrections and User study-city corrections. The migration is additive except for these deterministic repairs and installs PostgreSQL trigger functions used by the application.

Release 0.7.0 requires additive migration `20260716130000_secure_media`. Configure `STORAGE_DRIVER=s3` and all storage credentials before deploying the application build. The bucket must remain private; clients receive only presigned writes and application-authorized reads. Deploying the migration before the code is safe. Rolling the code back leaves unused media rows and enums in place.

Release 0.8.0 requires additive migrations `20260716160000_profiles` and `20260716161000_profile_media_retention`. Deploy both before serving profile edits or account requests. Existing members receive `MEMBERS` defaults for all profile audiences; no profile is made anonymously public by the migration. Do not purge media with `retainedAt` set because it may be required by an active or historical moderation case.

Release 0.9.0 requires additive migration `20260716170000_settings_preferences`. Deploy it before serving the new Settings routes. No data backfill is required; missing rows use application defaults and are created on first mutation.

Release 0.10.0 requires migrations `20260716185000_notification_type_moderation` and `20260716190000_notification_foundation` in order. PostgreSQL must commit the enum extension before the second migration inserts its template. Configure and schedule the worker before notification-producing traffic.

Release 0.11.0 has no migration. Smoke-test real shell badges, Command/Ctrl+K, desktop/mobile logout, Escape-close navigation, role changes, and platform loading/error/not-found states.

Release 0.12.0 requires migration `20260716210000_messages_safety`. Before deployment, query DIRECT conversations for exactly two participants and a sorted `directKey`. The migration safely removes only empty/no-message legacy shells and aborts on any non-empty invalid thread. After deployment, test inbox/history pagination, explicit read positions, archive/restore, delete-for-me, block/report reuse, image/PDF sending, participant-only delivery, asynchronous notification jobs, and `/admin/message-safety`.

Release 1.0.0-rc.2 requires additive migrations
`20260721100000_notification_announcement_audience` and
`20260721103000_official_communities`, followed by
`20260721110000_guide_cover_media`. Deploy all three before the application.
They store non-secret announcement audience metadata, add the explicit
official-community ownership marker/index, and add the secure Guide-to-
MediaAsset cover relation. No backfill is required: existing communities remain
user-created and existing guides continue without a cover until an Admin adds
one through the validated R2 workflow.

For an intentional local/demo reset only:

```bash
KONDO_ALLOW_DESTRUCTIVE_SEED=true npm run db:seed
```

Do not persist this opt-in in Vercel or shared environment configuration. Production reference data must be managed through reviewed migrations or a future non-destructive operational workflow.

## PostgreSQL test environment

`npm test` is intentionally database-backed. By default it uses the Docker Compose credentials and the separate `kondo_module3_test` database on `localhost:5432`; `scripts/prepare-test-db.mjs` creates that local database if needed and applies migrations. It never uses the application's `DATABASE_URL`.

In CI, configure `TEST_DATABASE_URL` to a disposable PostgreSQL database owned by the test job. Do not point it at preview or production data. The suite verifies reports, profiles, account requests, settings, sessions, notification outbox/deduplication/preferences/retries/audit, secure media, direct cardinality, message pagination/read/archive/clear state, attachment authorization, and message-safety permissions against real PostgreSQL.

## Performance checklist

- Keep authenticated reads in Server Components.
- Cache public directory endpoints for short periods.
- Add cursor pagination before directories exceed a few hundred records.
- Serve AVIF/WebP through the image pipeline and lazy-load below the fold.
- Track Core Web Vitals and keep the initial mobile route payload within budget.
- Move high-volume search and notification delivery to dedicated services only when measured demand requires it.
- Keep notification p95 queue age within target; alert on `FAILED`, repeated `WORKER_TIMEOUT`, and growing `PENDING` counts.
- Move messaging abuse limits to Redis before horizontally scaling application instances; keep direct-message writes transactional and monitor message/report rates.
- Monitor DIRECT-cardinality constraint failures, private attachment delivery denials, clear-history audit volume, and message-safety report backlog without logging message bodies, filenames, alt text, or media IDs.
- Alert on report backlog age, repeated assignment conflicts, failed Admin mutations, AuditLog insertion failures, and abnormal reopening volume.
- Ingest reference-data mutation failures and onboarding validation failures by their structured event names without logging submitted profile values.
- Alert on rejected/flagged upload rates, validation latency, orphan backlog, and storage deletion retries. Do not log signed upload tokens, object keys, original file bytes, or alt text.
- Alert on account-request backlog age, repeated version conflicts, retained-evidence storage growth, and profile-report volume. Do not log profile biographies, private contact fields, or request reasons.
- Alert on unusual global-session revocation volume and settings audit failures. Never log session tokens, hashes, full user agents, raw IP addresses, or preference request bodies.
- Alert on announcement spikes, unsafe-link rejection, template conflicts, and worker authentication failures. Never log job data or message previews.
- Ingest structured Kondo error events by their `event`, `errorType`, and optional code/digest fields. Do not re-enable Prisma query logging or attach raw request bodies and exception messages to production logs.

## Rollback

- Re-deploy the previous immutable Vercel build.
- Prefer backward-compatible migrations so code rollback remains possible.
- If a migration is unsafe to reverse, deploy a forward fix and follow the reviewed data-recovery procedure.
- Do not delete reports, evidence, or internal notes during rollback. The 0.5.0 application is backward-compatible with retained moderation rows, but rolling code back removes the operational UI while preserved data remains.
- Do not remove the Module 4 consistency triggers while version 0.6.0 is active. A code rollback after applying the migration remains compatible with the added columns, but older code will not expose active/verified administration.
- A code rollback after the 0.7.0 migration is schema-compatible, but stop media cleanup and uploads until a media-capable build is restored. Do not make the bucket public as a rollback shortcut.
- A code rollback after the 0.8.0 migrations leaves additive audience, request, and retention records in place. Preserve account requests, profile evidence, and retained media; restore a profile-capable build before processing those records.
- A code rollback after the 0.9.0 migration leaves additive preference rows in place. Older builds safely ignore them; do not drop the table during rollback because stored user choices should survive restoration.
- Before rolling back 0.10.0 code, pause the notification worker. Preserve jobs, templates, announcements, and notifications for a forward fix or restored compatible build.
- A code rollback after the 0.12.0 migration leaves additive participant timestamps, message-media relations, and DIRECT triggers in place. Preserve them; older code can read text messages but cannot create Module 10 attachments or operate archive/clear routes.
- Revoke compromised sessions by deleting affected `Session` rows and rotating `JWT_SECRET` when signature trust is lost.
