# Kondo Deployment

## Target architecture

- Application: Vercel, Node.js runtime, Next.js App Router.
- Database: managed PostgreSQL with connection pooling suitable for serverless workloads.
- Media: S3-compatible object storage with a CDN/image transformation layer.
- Shared limits and ephemeral coordination: Redis-compatible managed service before multi-instance launch.
- Monitoring: Vercel Web Analytics/Speed Insights plus an error and log provider.

## Required environment variables

| Variable                       | Required           | Description                                                                                         |
| ------------------------------ | ------------------ | --------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                 | Yes                | Pooled PostgreSQL connection string used by the application and Prisma.                             |
| `TEST_DATABASE_URL`            | CI/test only       | Disposable PostgreSQL database used by migration-backed integration and API E2E tests.              |
| `JWT_SECRET`                   | Yes                | Random secret of at least 32 bytes for signed session cookies.                                      |
| `NEXT_PUBLIC_APP_URL`          | Yes                | Canonical HTTPS origin used by metadata and absolute URLs.                                          |
| `KONDO_ALLOW_DESTRUCTIVE_SEED` | Local reset only   | Must be exactly `true` for an intentional non-production demo reset. Never configure in production. |
| `STORAGE_DRIVER`               | Yes                | `local` for development/test; `s3` for production. Local is rejected in production.                 |
| `STORAGE_LOCAL_ROOT`           | Local/test only    | Private filesystem root used by the local driver. Defaults to `.data/media`.                        |
| `STORAGE_BUCKET`               | Production media   | Private S3-compatible object-storage bucket name.                                                   |
| `STORAGE_REGION`               | Production media   | Region or `auto` for compatible providers.                                                          |
| `STORAGE_ENDPOINT`             | Provider dependent | Custom S3-compatible endpoint.                                                                      |
| `STORAGE_ACCESS_KEY_ID`        | Media launch       | Least-privilege upload/read identity.                                                               |
| `STORAGE_SECRET_ACCESS_KEY`    | Media launch       | Storage secret managed by Vercel.                                                                   |

## Vercel release process

1. Create separate preview and production PostgreSQL databases.
2. Configure environment variables in Vercel; never upload a local `.env`.
3. Run `npm ci` and `npm run db:generate` in CI.
4. Apply reviewed migrations with `npx prisma migrate deploy` as a controlled release step.
5. Provision an isolated disposable PostgreSQL test database through `TEST_DATABASE_URL`, then run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. `npm test` applies all Prisma migrations before Vitest.
6. Configure the private bucket CORS policy for presigned `PUT` from the exact application origins and keep public bucket access disabled.
7. Schedule `npm run media:cleanup` at least hourly with the same database and storage credentials.
8. Configure `NOTIFICATION_WORKER_SECRET` and schedule the notification worker at least once per minute, or run `npm run notifications:process`.
9. Deploy the immutable build.
10. Smoke-test enqueue/delivery, preferences, links, read/hide/pagination, real badge count, message archive/clear/read positions, private image/PDF delivery, community creation/review, open/request/invite access, owner transfer, event validation, post/comment images, content reports, Community CMS, templates, announcements, diagnostics, plus all previously listed product and Admin paths.
11. Monitor error rate, p95 latency, database connections, Web Vitals, notification queue age/failures, sign-in failures, rejected uploads, and pending storage deletions.

Do not run the demo seed in production. The seed refuses `NODE_ENV=production` and `VERCEL_ENV=production` unconditionally, and non-production runs still require the one-command opt-in `KONDO_ALLOW_DESTRUCTIVE_SEED=true`.

Release 0.13.0 requires all three community migrations before serving the new UI. Back up production, confirm every existing community has a valid `createdById`, and deploy migrations before the application build. The migration normalizes the creator as owner, marks existing published events validated, and aborts rather than accepting broken foreign-key or owner state.

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
