# Kondo Architecture

## System overview

Kondo is a modular monolith built with the Next.js App Router. That choice keeps the MVP operationally simple while retaining clean domain boundaries that can be extracted later if traffic or team structure demands it.

```text
Browser
  → Next.js App Router
    → Server Components for reads
    → Route Handlers for mutations and public JSON
      → authorization + Zod validation + rate limits
        → Prisma
          → PostgreSQL
        → provider-neutral object-storage contract
          → local private filesystem in development
          → private S3-compatible bucket in production
```

## Application layers

- `app/`: routes, layouts, metadata, server-rendered pages, and HTTP route handlers.
- `src/components/app`: shared authenticated application shell and navigation.
- `src/components/features`: community, marketplace, guide, messaging, city-exploration, and Admin operations presentation/interaction modules.
- `src/features`: typed feature data, registries, and domain contracts that are independent from route rendering.
- `src/components/ui`: composable design-system primitives.
- `src/lib`: authentication, permission matrices, centralized content visibility, moderation workflows, safe serializers, sessions, validation, queries, rate limits, transactional audit logging, and presentation helpers.
- `prisma`: the normalized data model, migration history, and deterministic demo seed.
- `tests`: unit security/validation coverage plus disposable PostgreSQL integration and API-level moderation workflow tests.
- `e2e` (Module 18): Playwright browser tests for critical user journeys, run against a built production server rather than `next dev` for stability under parallel workers. Entirely separate from `tests/` — different directory, different runner, different `npm run e2e` script — so it cannot be picked up by Vitest or interfere with `npm test`.

## Rendering and data flow

- Public marketing and authentication pages are statically rendered where possible.
- Signed-in product routes are dynamic Server Components because they depend on an HTTP-only cookie and user-specific PostgreSQL reads.
- Authentication is enforced by the server layouts and route handlers; there is no competing middleware/proxy auth layer. The shared `kondo_session` cookie is host-only and its `Secure` attribute is derived from both production mode and the effective request protocol.
- Next.js development resources allow private `192.168.x.x` origins so client hydration and HMR work when the dev server is opened through the Mac's LAN address. Extra development-only patterns can be supplied through `KONDO_DEV_ORIGINS`; this setting does not affect production request handling.
- The current-user lookup is request-memoized so nested layouts and pages do not duplicate session/database work. Its database read follows the hashed `Session` directly to the current `User`, so role and status changes take effect without trusting the role embedded in an older signed token. Revoked sessions fail immediately and expired rows are removed opportunistically.
- Client Components are limited to interaction-heavy areas: the app shell, the Explore utility menu, onboarding, reactions, bookmarks, favorites, notifications, composers, conversation safety actions, and guide checklists.
- Mutations use same-origin route handlers. The UI applies optimistic state where the action is reversible and restores state if the API rejects the mutation.
- Admin authorization is permission-based rather than route-name based. `src/lib/authorization.ts` defines the distinct Moderator, Admin, and Super Admin capabilities; every Admin page and route handler rechecks its exact permission on the server.
- The complete Admin route inventory, role matrix, first-Super-Admin procedure, City Hub workflow, and operator guidance live in [`docs/ADMIN.md`](./ADMIN.md). Super Admin-only role changes revoke target sessions and are audited; Admins can moderate user-created communities without rewriting their metadata, while explicitly official communities have administrator-owned metadata.
- `src/lib/moderation.ts` is the report workflow boundary. It owns queue visibility, safe DTO serialization, assignment, optimistic version checks, lifecycle validation, internal notes, evidence redaction, AuditLog browsing, and active conversation-report reuse.
- `src/lib/reference-data.ts` is the Country → City → University boundary. It owns safe Admin DTOs, active/verified lifecycle rules, dependency-safe CRUD, onboarding reference queries, and geographic validation. `src/lib/onboarding.ts` owns resumable draft persistence and atomic completion/update auditing.
- `src/lib/media.ts` is the media lifecycle boundary. It owns signed upload authorization, server-generated object keys, ownership, validation activation, replacement, attachment identity, secure delivery authorization, soft removal, Admin inspection, audit, and orphan cleanup. Community, Marketplace, profile, message, post, and Guide cover media all attach through this boundary; `src/lib/storage.ts` keeps local and S3-compatible drivers behind one contract.
- `src/lib/profiles.ts` is the profile and account-request boundary. It owns stable public/member/owner DTOs, field-level audience rules, coherent visible counters, profile editing, validated avatar attachment, saved-content resolution, profile reports, data-export/deletion requests, and safe Admin user review. Module 17 added Admin status control (suspend/reactivate/deactivate) and session revocation to this boundary; both are blocked against self-targeting and against an Admin acting on a Super Admin.
- `src/lib/guides.ts` is the Module 17 guide-CMS boundary. It owns Admin guide/step CRUD, unique-slug generation, and the publish/unpublish lifecycle; a guide cannot publish with zero steps, and deleting a guide is blocked while it is published or has recorded member progress.
- `src/lib/settings.ts` is the persisted preference and device-session boundary. It owns safe defaults, atomic preference writes, theme/language/notification settings, device-label derivation, current-session identification, targeted/global revocation, and audit-safe session DTOs.
- `src/lib/auth-tokens.ts` is the Module 14 email-verification and password-reset boundary. It owns single-use hashed tokens (mirroring `Session`'s hash-only storage), rate limits, atomic state transitions, and mandatory audit events; a successful password reset revokes every session for that user in the same transaction. It never returns a raw token to a caller in production — only the transactional email boundary (`src/lib/email.ts`) carries it, and that boundary throws rather than pretending to deliver when no provider is configured for production.
- `src/lib/email.ts` (Module 16) resolves to the Resend provider once `RESEND_API_KEY`/`EMAIL_FROM` are set, and otherwise stays on the safe no-op `console` path used since Module 14. `src/lib/email-digest.ts` closes the loop on the `UserPreference.emailDigest` (`NEVER`/`DAILY`/`WEEKLY`) setting that Module 7 already persisted but nothing previously read: a due member with at least one unread notification gets a summary email through the same transactional boundary, and `lastDigestSentAt` advances only when a digest is actually sent, so a member with nothing to report stays eligible instead of losing their next cycle.
- `src/lib/notifications.ts` owns safe internal links, templates, preferences, outbox enqueueing, deduplication, bounded retries, stale-lock recovery, member read/hide DTOs, persisted City/Community/University announcement audiences, and Admin diagnostics.
- `src/lib/messaging.ts` is the direct-message boundary. It owns canonical thread identity, exactly-two-participant checks, safe message DTOs, paginated inbox/history reads, aggregate unread state, participant archive/clear state, validated Module 5 attachments, block enforcement, asynchronous notifications, and privacy-preserving Admin safety metrics.
- `src/lib/communities.ts` is the community operations boundary. It owns reviewed creation, owner/member invariants, transfers, access policies, invitations/requests, post/event/comment lifecycles, validated public media attachment, transactional notifications, immutable content reports, and safe Admin CMS DTOs.
- Media uploads use two phases. The application first creates a short-lived signed upload authorization and a `PENDING` metadata row; after bytes reach private storage, the server reads them back, verifies size, MIME signature, extension, image decoding/dimensions or constrained PDF structure, computes a checksum, and only then transitions the asset to `ACTIVE/CLEAN`.
- Notification-producing transactions enqueue a deduplicated PostgreSQL `NotificationJob`. The scheduled worker applies current preferences/templates and records completion, skip, retry, or failure before creating the final notification.
- Report mutations and their mandatory AuditLog record execute in the same Prisma transaction. Version-guarded `updateMany` operations and a PostgreSQL partial unique index prevent double claims and duplicate active conversation reports under concurrency.
- Successful login and registration create the database session and their AuditLog event in one Prisma transaction. Registration also creates the member in that transaction, preventing partially created accounts when session or audit persistence fails.
- `src/lib/content-visibility.ts` is the shared policy boundary for community membership, published posts/questions/answers/guides, active listings, and polymorphic bookmark targets. Server Components, Prisma queries, Search, and mutations reuse these typed rules.
- Search applies minimal Prisma `select` projections and maps them into explicit DTOs through `src/lib/serializers.ts`; adding a field to a Prisma model cannot automatically expose it through Search.
- Public directory endpoints use short CDN cache windows. Personalized Search is authenticated, `private`, `no-store`, and varies by cookie so member-only results cannot cross users.

## Feature boundaries

- Identity: email/password authentication, signed session cookie, database session revocation, OAuth account model, onboarding, and profiles.
- Community: reviewed community CRUD, a single transferable owner, scoped Moderator/Member roles, open/request/invite access, posts, threaded comments, reactions, validated events, announcements, pinning, reports, retained evidence, and Admin CMS.
- Marketplace: categories, listings, media metadata, favorites, location filters, and seller contact handoff. There is intentionally no payment model.
- Student Hub: one navigation surface that composes the existing guide library and help-center routes with checklists, tips, articles, Q&A, and upcoming student events. `/guides` and `/help` remain stable content routes.
- Guides: categorized guides, ordered checklist steps, saved progress, persisted bookmarks, and editorial ownership.
- Help center: categorized questions, answers, helpful votes, accepted answers, and contextual entry into private messaging.
- Messaging: canonical two-person direct conversations, paginated inbox/history reads, reliable explicit read positions, per-participant archive and delete-for-me state, text/emoji, validated private image/PDF attachments, asynchronous notifications, block relationships, and generic moderation reports.
- Trust and operations: a role-scoped report queue, report detail/evidence workspace, assignment and lifecycle actions, internal notes, controlled reopening, a filtered AuditLog browser, and the existing Admin overview for Admin/Super Admin.
- Reference operations: Admin/Super Admin CRUD for countries, cities, and universities with active/verified state, protected deletion, relational correction, and mandatory transactional AuditLog records.
- Media: provider-neutral signed uploads, explicit ownership and visibility, validated immutable delivery IDs, accessible alt text, atomic replacement, retained removal metadata, scheduled orphan cleanup, and Admin/Super Admin inspection/removal.
- Profiles: member-editable identity and study context, independently configurable audience groups, validated private avatar media, visibility-consistent activity and counters, saved content, member safety actions, account lifecycle requests, and Admin/Super Admin operational review.
- Settings: persisted Light/Dark/System appearance, language intent, notification preferences, reused profile privacy controls, active device sessions, immediate revocation, logout, and reused export/deletion requests.
- Engagement: paginated notifications with individual/bulk read state, soft hiding, real counts, preferences, safe links, templates, asynchronous producers, bookmarks, and WAU analytics.
- City exploration: typed city and section contracts, database-backed versioned draft/published snapshots, structured Admin forms, protected draft previews, explicit revise/unpublish actions, a compatibility registry for unmanaged cities, reusable city/section routes, and editorial source links. Adding another city does not require a new page or component architecture.

## Scalability decisions

- PostgreSQL foreign keys and compound indexes serve the MVP query shapes.
- Community ownership uses a required `ownerId`, one partial unique OWNER membership, a deferred composite membership reference, and a synchronous trigger that prevents deleting or demoting the currently referenced owner. Transfers change the reference first and finish both membership roles atomically.
- Community/post/comment reports use a partial unique active-report index and immutable `COMMUNITY_CONTENT_SNAPSHOT` evidence. Validated media is retained for case review without copying provider keys.
- Migration-managed triggers enforce University country/city consistency and User study city/university consistency. Changing a city country synchronizes derived university country IDs; changing a university city synchronizes assigned user study city IDs.
- Media records store private object keys rather than provider URLs, keeping storage portable. Browser DTOs expose only stable media IDs and `/api/media/:id` delivery URLs.
- A replacement uploads to a new immutable object key. Activation and removal of the previous version occur in one database transaction, while provider deletion is retried asynchronously through `storageDeletePending`.
- Active but unattached uploads have a 24-hour grace period. The `media:cleanup` task rejects expired authorizations, removes stale unattached assets, and retries storage deletion without deleting audit metadata.
- Reported profile avatars receive an explicit retention marker before later replacement or removal. Normal profile delivery stops when the asset is replaced, while authorized Admin evidence review remains possible without exposing the storage key.
- Profile reads select only the fields required by the stable versioned DTO. Each profile section and its count uses the same audience and content-visibility policy, preventing private records from leaking through aggregate totals.
- User preferences are one-to-one and lazily materialized: missing rows resolve to safe defaults without requiring a destructive backfill. The authenticated shell synchronizes the saved theme after hydration, while the header toggle persists its explicit Light/Dark choice through the same API.
- Session management reuses the existing hashed database sessions. Browser DTOs expose only an opaque row ID, derived device label, current-device flag, and timestamps; token hashes, raw user agents, and IP addresses remain server-side.
- The authenticated layouts compute notification and direct-message unread counts in parallel and pass them to the shared shell. Both the global count and each paginated inbox page use bounded PostgreSQL aggregates rather than per-conversation unread queries.
- The shell owns the global Command/Ctrl+K Search shortcut, permission-derived Admin visibility, explicit logout, Escape-close mobile navigation, and shared platform loading/error/not-found boundaries.
- Notification jobs and rendered notifications both enforce `(recipientId, dedupeKey)` uniqueness. Status-guarded claims support concurrent workers, locks older than ten minutes recover automatically, and processing retries at most three times.
- Messages, Q&A replies, Marketplace contacts, and moderation results enqueue inside their source transaction. The Comment producer contract is ready for Module 11's real CRUD without inventing a parallel Comment backend.
- Search is isolated behind `src/lib/search.ts` and `/api/search`. Each searchable model carries a generated, field-weighted `tsvector` column with a GIN index; ranked candidate IDs come from a raw full-text query and are then re-checked through the same typed content-visibility policies used everywhere else before being ranked and returned, so full-text matching can never bypass an existing visibility rule. PostgreSQL text search can still be replaced by Typesense, Meilisearch, or OpenSearch later without changing page contracts.
- Cursor pagination for Search (`/api/search?type=&cursor=&limit=`) keys on `(ts_rank, id)`, cast to `double precision` so the cursor value round-trips the client without floating-point drift breaking tie-breaks between equally ranked rows. Categories whose lifecycle rule cannot be expressed as a simple column check (Community/Post visibility) overfetch candidates and drop invisible ones after the fact; the cursor still advances by raw scan position, so no page is skipped or repeated.
- Normal user reads consistently enforce lifecycle state in the database query: posts/questions/answers must be published, guides must be published, and marketplace listings must be active.
- `src/lib/rate-limit.ts` (Module 15) uses Upstash Redis (`@upstash/ratelimit` sliding window over `@upstash/redis`) as a shared, multi-instance limiter whenever `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are configured. Without them, or if Redis errors, it falls back to the original single-process in-memory bucket so every existing call site and test keeps working unmodified.
- The modular monolith is the source of truth until scale justifies separate search, notifications, or moderation workers.
- City-guide content is resolved through `src/features/explore/registry.ts`. Its current local typed records are a presentation-independent adapter boundary that can later read reviewed database records or a CMS without changing URL contracts or page components.
- Direct-conversation identity is centralized in `src/lib/messaging.ts`; entry points pass only a recipient ID, and the first successfully persisted message creates the conversation atomically.
- Migration-managed guards require canonical participant IDs, reject a third participant, validate completed DIRECT transactions at commit, and remove a direct thread as one unit if a participant is physically deleted.
- Delete-for-me records `clearedAt`/`deletedAt` on one participant only. It hides existing history without deleting shared messages, media metadata, or report evidence; a later message clears the hidden inbox state while retaining the prior visibility boundary.
- Message media remains private, attaches atomically to the conversation and message, and is delivered only to its owner, a current participant, or exact media operations staff. Message/API DTOs never contain provider object keys.
- Conversation reports preserve a bounded evidence snapshot independently from the live conversation. Deleting the source conversation or a participating account does not expose or erase the retained report snapshot through member APIs.
- The destructive demo seed is guarded before any deletion. It requires an explicit local/demo opt-in and refuses both Node and Vercel production environments unconditionally.

## Error and observability strategy

- Route handlers return generic client errors and do not expose stack traces or database details. Module 0–3 API boundaries convert unexpected failures into the same private, non-cacheable JSON error contract.
- `src/lib/logger.ts` emits structured operational events containing an event name and non-sensitive error classification only. It excludes exception messages, stacks, request bodies, credentials, user identifiers, IP addresses, and user agents.
- Prisma query/error console logging is disabled; development retains warning-level ORM diagnostics only.
- The Admin route group supplies dedicated loading, error, not-found, and permission-denied surfaces without exposing case data or implementation details.
- Admin report assignment, reassignment, unassignment, notes, review, resolution, dismissal, and reopening write audit records atomically with the mutation. Member block/unblock and report creation use the same transactional audit helper.
- Audit values are recursively redacted for secret-bearing keys. Within preserved evidence snapshots, Moderator views hide stable participant/message identifiers and usernames; Admin can see operational identity and attachment metadata; only Super Admin can see stable evidence identifiers and request security metadata.
- Analytics events use a constrained enum and optional JSON properties to prevent an uncontrolled event taxonomy.
- Production deployment must connect application errors, Web Vitals, database health, and audit alerts to an observability provider.
