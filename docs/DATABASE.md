# Kondo Database

## Platform

Kondo uses PostgreSQL through Prisma. The canonical schema is `prisma/schema.prisma`. Migration `20260715060000_kondo_community_mvp` creates the community-platform database, `20260715190000_student_hub_messages` adds private messaging and blocking, `20260716090000_operational_moderation` makes Admin report handling operational, `20260716230000_marketplace_enums`/`20260716231000_marketplace_operations` deliver the Module 12 Marketplace lifecycle, `20260717000000_search_full_text` adds the Module 13 full-text search vectors and indexes, and `20260717010000_auth_verification_reset` adds the Module 14 email-verification and password-reset token tables.

## Domain groups

### Identity and location

- `User`: identity, profile, role, status, education, languages, interests, onboarding, and activity timestamps.
- `Country`, `City`, `University`: normalized location and campus data used by onboarding, communities, profiles, marketplace filters, and search. Every record has an active lifecycle; each reference can be marked verified. University retains its existing `verified` field and now also has `isActive`.
- `Session`: hashed revocable session identifiers with expiry and request metadata.
- `EmailVerificationToken`, `PasswordResetToken`: hashed, single-use, expiring tokens for Module 14 email verification and password reset. Requesting a new token invalidates any unused prior token for that user.
- `UserPreference`: one-to-one persisted appearance, language, notification-category, and email-digest preferences.
- `OAuthAccount`: provider-neutral identity link table for future OAuth providers.

### Community

- `Community`: university, country, city, or topic group with reviewed lifecycle, open/request/invite access policy, verification/privacy, one required owner, optional validated cover, and moderation timestamps.
- `CommunityMember`: membership and community-scoped member/moderator/owner role. PostgreSQL permits one OWNER membership per community and protects the currently referenced owner.
- `CommunityAccessRequest`: reusable join request or invitation with pending/approved/rejected/cancelled lifecycle, creator/resolver, note, resolution, and timestamps.
- `Post`: discussion, question, event, or announcement with moderation, pin/removal state, event start/end/capacity/location, and event validation.
- `PostMedia`: ordered one-use relation from a post to validated `POST_IMAGE` assets.
- `Comment`: threaded post replies with edit and soft-removal timestamps.
- `Reaction`: typed reactions to a post or comment.

### Marketplace

- `MarketplaceCategory`: ordered category vocabulary with a description, icon, and active/inactive lifecycle enforced dependency-safe on delete.
- `MarketplaceListing`: seller, location, price in CNY fen, negotiation flag, lifecycle state (`DRAFT`/`ACTIVE`/`RESERVED`/`SOLD`/`ARCHIVED`/`EXPIRED`/`REMOVED`), publish/expiry/reserved/sold/archived/removed/moderated timestamps, and a rule-based fraud score/flags/review timestamp.
- `ListingImage`: an ordered image slot with a legacy nullable storage object key retained for historical rows and a unique optional relation to one validated Module 5 `MediaAsset`; new listings publish exclusively through the `MediaAsset` relation.
- `ListingFavorite`: user/listing join table.

There are no transaction, payment, wallet, transfer, payout, or settlement tables in the MVP.

### Knowledge and guidance

- `Guide`, `GuideStep`, `GuideProgress`: editorial checklists and user completion. Module 17 added an Admin CMS over these existing tables (create/edit/publish guides, add/edit/delete steps); no schema change was required.
- `CityHub` (`CityHubStatus`): Module 20 editorial record for the "Explore your city" hubs. One row per city `slug` holds the working `draft` payload (JSONB, validated against the `ExploreCity` shape) and, once published, a `published` JSONB snapshot. A `DRAFT → REVIEW → PUBLISHED` state machine with a `version` column for optimistic concurrency; publishing copies `draft` into `published` and stamps `publishedAt`. Public `/explore/[city]` pages read the `published` snapshot when present and otherwise fall back to the static typed registry in `src/features/explore`.
- `Question`, `Answer`, `AnswerVote`: searchable help-center knowledge with a selected best answer.
- `Bookmark`: a constrained polymorphic bookmark for posts, listings, guides, and questions.

### Trust, communication, and analytics

- `Notification`: rendered notification with actor, safe link, template/deduplication metadata, read state, and soft-hidden state.
- `NotificationTemplate`: fixed-key, versioned, active/inactive title/body templates with bounded variables.
- `NotificationJob`: PostgreSQL outbox record with producer, template, safe link, dedupe identity, retry/lock/completion state, and optional announcement.
- `NotificationAnnouncement`: audited Admin product announcement and asynchronous recipient fan-out state.
- `Conversation`: a direct thread with a canonical two-user `directKey` and latest-message timestamp.
- `ConversationParticipant`: direct membership, `lastReadAt`, archive state, and participant-local `clearedAt`/`deletedAt` history visibility boundaries.
- `Message`: ordered text/image/document records with safe display metadata and a unique optional relation to one validated private `MediaAsset`.
- `UserBlock`: directional user-to-user block relation. Either direction prevents new messages while preserving moderation history.
- `Report`: preserved moderation case with reporter/subject, assignment history fields, optimistic `version`, status, typed decision, resolution, resolver, and reopening metadata.
- `ReportNote`: append-only internal case notes with nullable historical author identity.
- `ReportEvidence`: immutable JSON evidence snapshots captured at report time. Conversation snapshots retain bounded message/participant context without storing attachment object keys.
- `MediaAsset`: provider-neutral media metadata and lifecycle. It records owner, server-generated private object key, purpose, visibility, declared/detected MIME, size, image dimensions, alt text, checksum, upload expiry, validation/attachment timestamps, replacement lineage, removal reason/actor, and pending provider deletion.
- `AccountRequest`: a versioned member request for data export or account deletion, with operational status, member reason, Admin resolution, processor identity, and processing timestamps.
- `AuditLog`: append-oriented security/operations history.
- `AnalyticsEvent`: constrained engagement events used to measure WAU, retention, community activity, marketplace activity, guide completion, and search.

## Important indexes

- User location, university, status, and last activity.
- Country active/name, City country/active/name, and University city/active/verified/name.
- Community type, visibility, location, campus, and creation time.
- Community status/privacy/time, owner/status, member role/time, and access-request community/user lifecycle.
- Post community/status/time, author/time, event date, and pin state.
- Post community/type/validated-event date and ordered unique post media.
- Listing status/time, category/status, city/status, seller/status, price, status/expiry, and fraud-score/status/time.
- MarketplaceCategory active/order.
- Question category/status/time.
- Notification recipient/read/time, recipient/hidden/time, actor, job, and recipient/deduplication identity.
- Notification-template type/active state; notification-job status/availability, recipient/status, announcement/status, and dedupe identity.
- Notification-announcement status/queue time and creator/time.
- Conversation direct identity and latest-message time.
- Conversation participant user/conversation, user/read time, and user/deleted/archive state.
- Message conversation/time, sender/time, and unique media identity.
- Blocked-user lookup.
- Report status/update time, target identity, reporter/time, subject/status, and assignee/status/update time.
- Report-note case/time and author/time.
- Report-evidence case/capture time and capturer/time.
- Media owner/status/time, upload expiry, attachment/orphan age, purpose/status, scan/status, replacement lineage, and attachment identity.
- Account-request owner/status/time, type/status/time, and processor/status/time.
- User-preference email-digest/update time for future asynchronous digest selection.
- A migration-managed partial unique index permits only one active `PENDING` or `PROCESSING` request of each type per member.
- A migration-managed partial unique index permits only one active profile report per reporter and reported profile.
- A migration-managed partial unique index permits only one `OPEN` or `REVIEWING` conversation report per reporter and conversation. Prisma does not express this partial-index predicate in the schema DSL.
- Analytics name/time, user/time, and session.
- `Community`, `MarketplaceListing`, `Guide`, `Question`, `Post`, and `User` each carry a generated, field-weighted `searchVector` (`tsvector`) column with a GIN index, backing Module 13 full-text search. Prisma expresses these as `Unsupported("tsvector")`; the generation expression and index live only in the migration.
- `EmailVerificationToken`/`PasswordResetToken` user/used-at and expiry.

## Data rules

- Prices are stored as integer fen to avoid floating-point currency errors; this is display pricing only.
- Media uses portable private object keys. API responses never expose those keys; delivery is authorized through the stable `MediaAsset.id`.
- `User.avatarMediaId` is the single active profile-avatar attachment. Profile, location, education, language, community, activity, and marketplace audiences are stored independently as `PUBLIC`, `MEMBERS`, or `PRIVATE`.
- Profile API responses use explicit projections and a versioned DTO. Private contact fields, roles, account status, sessions, and internal timestamps are never part of another member's profile response.
- Account export/deletion requests are preserved as operational records. Members can cancel only pending requests; Admin/Super Admin process requests through version-guarded audited transitions.
- Missing `UserPreference` rows resolve to `SYSTEM`, `ENGLISH`, all in-app categories enabled, and no email digest. The first settings mutation creates the one-to-one row atomically with its AuditLog.
- Producers enqueue in the source transaction. Preference-disabled, inactive-recipient, and inactive-template jobs become `SKIPPED`; moderation results bypass member preferences and cannot be disabled.
- Jobs transition `PENDING → PROCESSING → COMPLETED|SKIPPED|FAILED`, recover ten-minute stale locks, and retry no more than three times.
- Links must resolve to approved internal routes. Member DTOs revalidate stored links and return `null` for unsafe legacy values.
- Session settings continue to use the existing `Session` table. Revocation deletes the hashed session row immediately; the mandatory AuditLog preserves who initiated the operation without storing the token hash.
- `MediaAsset` transitions through `PENDING → PROCESSING → ACTIVE` after server-side byte validation, or to `REJECTED`; active media can later become `REMOVED`. Database checks require every active row to be `CLEAN` with detected MIME, checksum, upload timestamp, and validation timestamp. Active images also require positive dimensions.
- Replacement attempts may share a previous `replacesId`, but transactional status guards permit only one attempt to remove and supersede the active previous row.
- Storage deletion is intentionally separate from metadata deletion. `storageDeletePending` retains failed provider cleanup work while the removed/rejected metadata and AuditLog history remain available.
- Deleting a user cascades their authored community content where ownership cannot be retained; report reporters/subjects/staff references, evidence capturers, note authors, and audit actors become nullable where history must remain.
- A reaction can target a post or comment. Application validation must ensure exactly one target is supplied.
- `Community.ownerId` must resolve to that community's unique OWNER membership. The current owner cannot be demoted, removed, or moved; ownership transfer updates the reference and both roles in one transaction.
- `CommunityAccessRequest` has one row per community/user/type and is reused when a new request or invitation supersedes a terminal one.
- Member-created events are pending until `eventValidatedAt` is written by community staff; published legacy events were backfilled as validated. Event end must follow start and capacity must be positive.
- Each `MediaAsset` can be attached to at most one `PostMedia`; post order is unique and bounded by application validation to four images.
- One active `OPEN` or `REVIEWING` report is permitted per reporter and Community/Post/Comment target. Evidence uses `COMMUNITY_CONTENT_SNAPSHOT`, retains referenced clean media, and remains independent of later edits/removal.
- `Question.bestAnswerId` is intentionally a soft reference in the MVP; application logic must ensure the answer belongs to the question.
- A direct conversation uses the sorted participant IDs as a unique `directKey`, preventing duplicate histories when either user initiates contact.
- Migration-managed guards reject non-canonical participants and a third member, validate exactly two participants at transaction completion, and delete a DIRECT thread as one unit if a participant is physically deleted.
- `Message.mediaId` links one active validated Module 5 asset to at most one message. Historical attachment metadata remains nullable for safe display/migration compatibility; provider keys are not copied into message DTOs.
- Delete-for-me sets participant `clearedAt` and `deletedAt` rather than deleting shared rows. New messages clear the hidden inbox state while queries continue to exclude history at or before `clearedAt`.
- Blocking does not erase existing messages. It prevents new delivery in either direction and leaves reports/audit evidence intact.
- `OPEN` and `REVIEWING` reports have no decision, resolution, or resolver metadata. `RESOLVED` and `DISMISSED` reports require a decision, resolution, and resolution timestamp through a database check constraint.
- Report mutations use an integer version as an optimistic concurrency token. Stale Admin writes return a conflict instead of overwriting a newer assignment or decision.
- Admin code exposes explicit moderation DTOs only. Prisma report, note, evidence, user, and AuditLog objects are not returned raw.
- `User.countryId` is the member's country of origin. `User.cityId` and `User.universityId` are the study location; the selected university must belong to the selected city.
- A university's `countryId` must equal its city's country. PostgreSQL triggers reject inconsistent direct writes and synchronize derived country/city fields when an Admin corrects a parent reference.
- Referenced countries, cities, and universities cannot be hard-deleted through the Admin API; they must be deactivated until dependencies are removed.

## Migrations and seed

```bash
npm run db:generate
npx prisma migrate deploy
KONDO_ALLOW_DESTRUCTIVE_SEED=true npm run db:seed
```

The seed is destructive and is for intentional local/demo resets only. It creates locations, universities, six users, communities, conversations, events, listings, guides, Q&A, notifications, a moderation report, and analytics activity. It fails unless `KONDO_ALLOW_DESTRUCTIVE_SEED=true` is supplied and always refuses `NODE_ENV=production` or `VERCEL_ENV=production`, even with that opt-in.

The test runner prepares a separate PostgreSQL database named `kondo_module3_test` by default and applies migrations before Vitest. CI must provide `TEST_DATABASE_URL` for an isolated disposable database; tests never use the application `DATABASE_URL`.

Release 0.5.0 adds `ReportDecision`, `ReportEvidenceKind`, `ReportNote`, `ReportEvidence`, report ownership/lifecycle fields, operational indexes, a partial active-conversation-report uniqueness guard, and a terminal-state check constraint. Legacy resolution text found on an active report is retained as an internal note before the active lifecycle fields are normalized.

Release 0.5.1 does not change the schema. It validates session lifecycle behavior against the existing `Session` and `User` relations with PostgreSQL integration coverage.

Release 0.6.0 adds migration `20260716110000_reference_data_onboarding`. It adds active/verified reference statuses and indexes, normalizes University country IDs from City, corrects historical User city/university mismatches, and installs location-consistency/synchronization triggers.

Release 0.7.0 adds migration `20260716130000_secure_media`. It creates the media enums and `MediaAsset` table, ownership/removal/replacement relations, lifecycle and integrity checks, and operational indexes. The migration is additive and does not rewrite existing legacy object-key fields; later domain modules migrate those fields when they adopt `MediaAsset`.

Release 0.8.0 adds migrations `20260716160000_profiles` and `20260716161000_profile_media_retention`. They add profile audience preferences, the validated avatar relation, account-request lifecycle data, profile-report evidence and active-report uniqueness, plus explicit media retention metadata for reported avatar evidence. Both migrations are additive.

Release 0.9.0 adds migration `20260716170000_settings_preferences`. It adds `ThemePreference`, `AppLanguage`, and `NotificationDigest`, plus the one-to-one `UserPreference` table. Existing users require no backfill because application defaults match database defaults and a row is created on first mutation.

Release 0.10.0 adds migrations `20260716185000_notification_type_moderation` and `20260716190000_notification_foundation`. The enum extension is committed separately before adding notification templates, announcements, jobs, read/hide metadata, deduplication, retries, diagnostics, and six base templates.

Release 0.12.0 adds migration `20260716210000_messages_safety`. It adds participant-local clear/delete timestamps, a unique message-media relation, inbox-state and media indexes, message-content integrity, and DIRECT cardinality/canonical-identity triggers. The migration removes only legacy DIRECT shells with zero participants and zero messages; any other invalid legacy DIRECT row stops deployment for manual review.

Release 0.13.0 adds migrations `20260716220000_report_evidence_community`, `20260716221000_community_operations`, and `20260716222000_community_owner_trigger_fix`. They add community/access lifecycles, required ownership, cover/post media, event validation, removal timestamps, content evidence, active-report uniqueness, relational indexes/checks, creator-owner normalization, and PostgreSQL owner invariants. Existing published events are marked validated; existing creators become the operational owner.

Release 1.0.0-rc.2 adds migrations
`20260721100000_notification_announcement_audience` and
`20260721103000_official_communities`, plus
`20260721110000_guide_cover_media`. Announcements now persist their resolved
audience selector as JSON for diagnostics and auditability. Communities now
have an indexed `isOfficial` marker, separate from `isVerified`, so
administrator-created spaces can be distinguished from user-created spaces.
Guides now reference one validated `MediaAsset` cover through `coverMediaId`;
the legacy raw key remains untouched for compatibility but is not used by the
new CMS. All three migrations are additive and require no data rewrite.

## Part 8 migration decision

Part 8 requires no schema or production data transformation, so it adds no
Prisma migration. Compatibility remains additive and read-only. Run
`npm run legacy:audit` before release to reconcile legacy scholarships,
ScholarshipAgent retention, Organization slug aliases, legacy Journey inference
and possible Marketplace Housing records without writing data.

Any future transformation must default to dry-run, log aggregate counts without
PII, detect duplicates, support safe rerun/partial recovery, use bounded
transactions and ship a compensating rollback. Never use `prisma db push` or a
destructive seed against production. See
[`LEGACY_COMPATIBILITY.md`](./LEGACY_COMPATIBILITY.md).
