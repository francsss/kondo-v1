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

## Next — make every core loop fully operable

1. Add cursor pagination and PostgreSQL full-text indexes; measure before adopting a dedicated search service.
2. Finish email verification, password reset, session/device management, and one first-party OAuth provider.
3. Replace in-memory rate limits—including community/message/block/report buckets—with shared Redis-compatible limits.
4. Connect email digest delivery to a reviewed email provider and consent policy when infrastructure is approved.
5. Add Admin actions for user status/session control and guide publishing on top of the completed report/audit foundation.
6. Add browser-driven end-to-end tests for onboarding, authorization, community ownership, posting, marketplace, guide progress, responsive Admin operations, and mobile navigation.
7. Instrument WAU, cohort retention, community engagement, event approval, marketplace contacts, guide completion, Search success, and moderation queue health.
8. Move city-hub content to a reviewed editorial source with partner verification, expiry states, and moderation for jobs and dated events.
9. Add event RSVP only after the validated event lifecycle has production usage data.

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
