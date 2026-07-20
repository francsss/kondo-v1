# Kondo Roadmap

The north star is Weekly Active Users. Work is prioritized by whether it helps students return for useful community, guidance, or marketplace activity without adding operational or safety risk.

## Now — MVP foundation (completed in 0.2.0)

- Product pivot from transfers to the student community platform.
- Premium responsive landing, authentication, onboarding, and personalized shell.
- Community directory, feeds, events, pinned posts, comments/reaction data model, and moderation foundations.
- Marketplace categories, listings, favorites, city filters, seller profiles, and explicit no-payment boundary.
- Guide library, checklist steps, saved progress, persisted bookmarks, help-center Q&A, best answers, global search, bulk notification read state, and profiles.
- Admin overview, roles, reports, audit logs, analytics event vocabulary, current documentation, and quality automation.

## Now — Competition city extension (completed in 0.3.0)

- Launch the first `Explore Your City` hub with Jiaxing as the reference implementation.
- Connect international students with verified city context across companies, products, universities, opportunities, events, services, and local history.
- Keep city content behind a typed registry so Shanghai, Hangzhou, Beijing, and profile-selected cities can reuse the same routes and components.
- Preserve every existing product route and all five mobile bottom-navigation destinations; discovery lives in the top-right utility menu.

## Now — Student Hub and direct messages (completed in 0.4.0)

- Merge the Student and Help navigation destinations into Student Hub while preserving the complete guide and help-center routes and behavior.
- Use the released navigation space for Messages: searchable direct-conversation history, previews, timestamps, unread badges, text, and emoji.
- Allow natural conversation entry from profiles, posts, marketplace listings, comments, questions, and Student Hub answers with no friend/follow model.
- Create a conversation only when the first message is persisted; prevent duplicate direct threads through a canonical participant key.
- Protect the MVP with participant authorization, block/report controls, audit records, new-recipient limits, general send limits, and duplicate-send rejection.

## Now — critical security stabilization (completed in 0.4.2)

- Authenticate Search and replace Prisma-object responses with minimal stable public DTOs.
- Enforce public-or-member visibility for private communities and their posts across directories, profiles, Student Hub events, Search, bookmarks, reactions, and direct detail routes.
- Enforce `ACTIVE` marketplace, `PUBLISHED` Q&A/content, and published-guide boundaries on normal reads and mutations.
- Remove unsupported user/member trust claims while retaining community verification backed by the existing community field.
- Make the destructive demo seed opt-in only and impossible to run in Node or Vercel production.
- Add focused authorization regression coverage without introducing a CMS, trust model, new module, navigation change, or Prisma migration.

## Now — operational Admin moderation (completed in 0.5.0)

- Formalize distinct Moderator, Admin, and Super Admin permissions and enforce every capability on the server.
- Deliver a filtered/paginated report queue, case detail, assignment/reassignment, internal notes, resolution/dismissal, controlled reopening, restricted evidence, and a global AuditLog browser.
- Preserve bounded conversation evidence and historical report ownership while preventing duplicate active conversation reports and concurrent double claims.
- Make every report mutation and block/unblock action atomic with its mandatory AuditLog event.
- Add disposable PostgreSQL integration tests and an API-level report-to-resolution E2E path covering permissions, redaction, lifecycle, audit, rollback, and concurrency.

## Now — Modules 0–3 compatibility stabilization (completed in 0.5.1)

- Enforce immediate PostgreSQL-backed role and account-status changes on every authenticated request.
- Validate suspended, deactivated, expired, and revoked-session behavior with real PostgreSQL coverage.
- Make login session creation and registration atomic with their required security audit events.
- Standardize controlled Module 0–3 API failures and structured non-sensitive server logging.
- Complete Admin loading, generic error, not-found, and permission-denied route states.
- Keep private-community bookmark visibility member-scoped, including for global moderation roles.

## Now — Module 4 onboarding and reference data (completed in 0.6.0)

- Enforce the Country → City → University reference hierarchy in application validation and PostgreSQL consistency triggers.
- Preserve country of origin separately from the Chinese study city/university relationship.
- Add active and verified operational states, reviewed onboarding queries, and deterministic repair of historical mismatches.
- Save onboarding drafts on each step and allow completed members to edit their student context from Settings.
- Deliver searchable, paginated, audited Admin CRUD for countries, cities, and universities with dependency-safe deletion.

## Now — Module 5 media and files (completed in 0.7.0)

- Add short-lived signed uploads with server-generated keys and exact owner/purpose/size/MIME claims.
- Activate only server-read, decoded, dimension-checked, checksum-verified images or constrained PDFs.
- Deliver active media through stable authorized IDs while keeping private provider keys and buckets hidden.
- Support accessible alt text, immutable replacement, owner deletion, orphan cleanup, and provider-deletion retries.
- Deliver Admin/Super Admin media inventory, inspection, secure preview, reasoned removal, and atomic audit.

## Now — Module 6 profiles (completed in 0.8.0)

- Deliver owner profile editing for identity, biography, study context, independent audience groups, and validated Module 5 avatar attachment.
- Expose a stable versioned profile DTO with visibility-consistent sections, counters, activity, marketplace items, communities, and saved-content resolution.
- Add profile block/report entry points, immutable profile evidence, and retained reported-avatar review without friend, follower, reputation, or badge mechanics.
- Add versioned data-export/account-deletion requests plus safe Admin/Super Admin user and request review with atomic audit.

## Now — Module 7 settings, privacy, language and theme (completed in 0.9.0)

- Deliver complete responsive Settings routes for profile, Appearance, Privacy, Notifications, Language, Sessions & devices, and Account.
- Persist Light, Dark, System, language intent, notification categories, and digest preference in one additive user-preference model.
- Reuse Module 6 audiences and account requests rather than creating parallel privacy or account-lifecycle systems.
- Expose safe device-session DTOs with targeted, other-device, current-device, and global revocation plus atomic audit.
- Preserve incomplete translation as an explicit limitation while storing the member's preferred future language.

## Now — Module 8 notifications (completed in 0.10.0)

- Deliver a shared PostgreSQL outbox with bounded templates, preferences, deduplication, safe links, retries, stale-lock recovery, and asynchronous processing.
- Add individual click-to-read, mark-all-read, soft hiding, pagination, real unread counts, and the authenticated-shell badge.
- Route Messages, Q&A replies, Marketplace contacts, and moderation outcomes through transactional producers; prepare the Comment producer for Module 11.
- Add Admin/Super Admin template management, product announcements, diagnostics, rate limits, and atomic audit.

## Now — Module 9 shell and navigation (completed in 0.11.0)

- Replace static shell indicators with real PostgreSQL Messages and Notifications unread counts.
- Add accessible desktop/mobile logout, Command/Ctrl+K Search, Escape-close menu behavior, and permission-derived Admin visibility.
- Add shared platform loading, retryable error, and non-disclosing not-found states without changing the five destinations.

## Now — Module 10 messages and safety (completed in 0.12.0)

- Add database-backed inbox/history pagination, search, archive/restore, explicit read positions, aggregate unread state, and participant-local delete-for-me retention.
- Enforce canonical exactly-two-participant DIRECT threads in PostgreSQL and keep physical participant deletion from leaving invalid one-member histories.
- Attach validated private Module 5 images/PDFs atomically, preserve asynchronous notification jobs, and keep block/report/evidence rules unchanged.
- Add Admin/Super Admin message-safety metrics and report handoff without a general private-conversation browser.
- Validate the complete workflow against real PostgreSQL, including cardinality, retention, private delivery, evidence redaction, and role separation.

## Now — Module 11 communities, posts, comments, and events (completed in 0.13.0)

- Deliver reviewed Community CRUD, a single transferable owner, scoped Moderator/Member roles, and open/request/invitation-only access.
- Add complete post and threaded-comment operations, reactions, pinning, staff announcements, validated member events, and up to four Module 5 post images.
- Preserve Community/Post/Comment report evidence, retain referenced media, reuse active cases under concurrency, and keep Moderator/Admin evidence redaction.
- Add paginated discovery and a complete Admin/Super Admin Community CMS plus local owner/moderator operations.
- Validate owner invariants, audit rollback, access lifecycles, content, media, notifications, report concurrency, redaction, and Admin permissions against real PostgreSQL.

## Now — Module 12 Marketplace lifecycle (completed in 0.14.0)

- Deliver the full listing lifecycle (DRAFT, ACTIVE, RESERVED, SOLD, ARCHIVED, EXPIRED, REMOVED) with an enforced seller state machine and Admin override.
- Migrate listing publishing to validated Module 5 media assets; retire legacy object-key-only listing images from the live create/edit path and the demo seed.
- Add rule-based fraud scoring that automatically holds high-risk listings for review before publication.
- Add a seller dashboard, category CRUD, automated expiry (scheduled worker + `marketplace:expire` script), and a permission-separated Marketplace Admin CMS.
- Preserve Module 11 report/evidence patterns: role-redacted evidence snapshots and reused active-report concurrency handling for listings.
- Add a dedicated PostgreSQL integration suite covering fraud holds, lifecycle transitions, idempotent expiry, evidence redaction, CMS permissions, pagination, and audit rollback.

## Now — Module 13 search pagination and full-text indexing (completed in 0.15.0)

- Give every searchable model (`Community`, `MarketplaceListing`, `Guide`, `Question`, `Post`, `User`) a generated, field-weighted PostgreSQL `tsvector` column with a GIN index; title/name matches rank above description/body-only matches.
- Replace `ILIKE`-style substring matching with `websearch_to_tsquery`/`ts_rank` full-text queries, re-checked through the existing typed content-visibility policies so full-text can never surface a row normal visibility rules would hide.
- Add cursor-paginated single-category results (`/api/search?type=&cursor=&limit=`) alongside the existing mixed-category preview, with a "View all" entry point from the `/search` page and a client "Load more" panel.
- Measured before adopting a dedicated search service: PostgreSQL full-text plus a GIN index is sufficient at current data volume; `src/lib/search.ts` stays isolated so a future Typesense/Meilisearch/OpenSearch migration would not change page contracts.

## Now — Module 14 email verification and password reset (completed in 0.16.0)

- Add single-use, hashed, expiring email-verification and password-reset tokens (`EmailVerificationToken`, `PasswordResetToken`), mirroring `Session`'s hash-only storage.
- Add `/api/auth/verify-email/*` and `/api/auth/password-reset/*`, a `/forgot-password` request page, a `/reset-password` confirmation page, a `/verify-email` confirmation page, and a resend-verification banner in Settings → Account.
- Password-reset requests are rate limited and always return the same generic response regardless of whether the email matches an account, preventing enumeration; confirming a reset revokes every session for that user.
- Add `src/lib/email.ts`, a provider-neutral transactional email boundary that safely no-ops in development without a configured provider and refuses to silently pretend delivery succeeded in production.
- Session/device management was already delivered in Module 7 (Settings → Sessions & devices) and needed no further work here.
- Deliberately deferred: selecting and wiring one first-party OAuth provider requires a product decision (which provider) and real client credentials neither of which exist yet; it stays in the list below.

## Now — Module 17 Admin user status/session control and guide publishing (completed in 0.17.0)

- Add `USER_MANAGE` (Admin/Super Admin only): suspend/reactivate/deactivate an account with a required reason, and revoke every session for a user independent of a status change. Both are blocked against the actor's own account, and blocked against a Super Admin target unless the actor is also Super Admin.
- Suspending or deactivating an account revokes every session for it in the same transaction as the status change.
- Add `GUIDE_CMS_VIEW`/`GUIDE_CMS_MANAGE` (Admin/Super Admin only): create/edit guides, manage ordered steps, and publish/unpublish. No schema change was needed — `Guide`/`GuideStep` already existed but had no Admin surface. A guide cannot publish with zero steps, and cannot be deleted while published or while any step has recorded member progress.
- Add `/admin/guides` and `/admin/guides/[id]`, and status/session controls on `/admin/users/[id]`.

## Now — Modules 15/16/18/19/20 infrastructure and content operations (completed in 0.18.0)

- Module 15: Upstash Redis-backed shared rate limits (`@upstash/ratelimit`), env-var driven, with an automatic in-memory fallback when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are unset or Redis is unreachable. All rate-limited endpoints await the shared limiter.
- Module 16: Resend transactional email boundary (`src/lib/email.ts`), env-var driven (`RESEND_API_KEY`/`EMAIL_FROM`), wired to verification, password-reset, and digest flows; safely no-ops outside production and refuses to pretend delivery in production.
- Module 18: Playwright E2E suite under `./e2e` (guest/authenticated/setup projects, production web server) covering landing/auth, sign-out, and authenticated critical journeys; isolated from the Vitest unit/integration suite.
- Module 19: analytics instrumentation on the existing `AnalyticsEvent` model for all ten core events, including the newly-added `EXPLORE_CITY_VIEWED`.
- Module 20: database-backed City Hub editorial workflow (`CityHub`, `CityHubStatus`) with a Draft → Review → Published state machine, admin-only publishing (`CITY_CMS_VIEW`/`CITY_CMS_MANAGE`), schema-validated JSON content, versioned optimistic concurrency, transactional audit, and a static-registry fallback so existing city pages keep working.

## Next — make every core loop fully operable

1. Select and wire one first-party OAuth provider (needs a product decision on provider plus real client credentials before implementation).
2. Provision real Upstash Redis and Resend credentials in the deployment environment to activate shared rate limits and live transactional email (both integrations are implemented and dormant until the env vars exist).
3. Expand the browser-driven E2E suite to onboarding, community ownership, posting, marketplace, guide progress, responsive Admin operations, and mobile navigation.
4. Instrument the remaining WAU/retention/queue-health dashboards on top of the now-populated analytics events.
5. Migrate more city-hub content off the static registry as cities adopt the editorial workflow, and add partner verification, expiry states, and moderation for jobs and dated events.
6. Add event RSVP only after the validated event lifecycle has production usage data.

## Then — trust and engagement depth

- Community moderator tools, contributor badges, event RSVP, better accepted-answer workflows, and content quality signals.
- Marketplace expiry, sold/reserved lifecycle, safer chat handoff, scam heuristics, and trusted-seller signals.
- Delivery receipts beyond the current reliable per-participant read timestamp, typing/presence, and broader document types after measured demand and policy approval. The moderation evidence snapshot remains metadata-safe and read-only.
- Guide editorial workflow, version history, city/university variants, and official-source review reminders.
- Internationalization for English, French, Arabic, and selected African languages based on measured demand.
- Select the default city hub from a user's profile while retaining an explicit city switcher and stable shareable URLs.
- Accessibility audit, low-bandwidth mode, offline guide access, and installable PWA behavior.

## Later — prepared, not implemented

- Group messaging, jobs, scholarships, referrals, partner APIs, verification, and events as deeper modules.
- Payments, student wallet, university/housing/insurance payments, bank integrations, cross-border finance, and KYC are explicitly outside the MVP. They require a separate legal, regulatory, risk, and architecture program before any implementation.

## Decision rules

- Reliability and speed outrank feature count.
- No feature ships without implementation, tests, documentation, changelog entry, and a successful production build.
- Do not create a separate service until profiling shows the modular monolith is the constraint.
- Reject features that add notification noise or fail to improve long-term student engagement.
