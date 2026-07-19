# Kondo API

All state-changing browser requests require an authenticated database session where applicable and pass a same-origin check. JSON payloads are validated with Zod. Error bodies use `{ "error": "message" }`. Unexpected Module 0–3 failures return a generic private `500` response and never serialize Prisma errors, SQL, stacks, or exception messages.

## Authentication

| Method  | Endpoint             | Auth    | Purpose                                                             |
| ------- | -------------------- | ------- | ------------------------------------------------------------------- |
| `POST`  | `/api/auth/register` | Public  | Create a member, database session, and secure cookie. Rate limited. |
| `POST`  | `/api/auth/login`    | Public  | Verify credentials and create a revocable session. Rate limited.    |
| `POST`  | `/api/auth/logout`   | Session | Revoke the database session and clear the cookie.                   |
| `GET`   | `/api/auth/me`       | Session | Return the safe current-user projection.                            |
| `PATCH` | `/api/onboarding`    | Session | Save a validated resumable onboarding draft without completing it.  |
| `PUT`   | `/api/onboarding`    | Session | Complete or update student context atomically with its audit event. |

Authentication cookies are host-only, HTTP-only, `SameSite=Lax`, scoped to `/`, and expire after seven days. `Secure` is enabled only for production HTTPS requests, including Vercel's forwarded HTTPS protocol, and omitted for local HTTP through `localhost` or a LAN IP. Creation and deletion share the same name, path, SameSite, and transport policy. Password hashes use bcrypt cost 12. OAuth providers can be added through `OAuthAccount` without changing `User` identity.

Session authorization always uses the current PostgreSQL user role and status. Suspended or deactivated accounts, expired sessions, and revoked session rows receive `401`; an outdated role stored in the signed token cannot retain an old Admin permission. Successful login persists its session and audit event atomically, while registration persists user, session, and audit atomically.

The authenticated shell uses server-side aggregate reads for real Notifications and Messages unread counts. Logout remains `POST /api/auth/logout`; shell and Settings controls both revoke the current database session and clear the same cookie.

Onboarding treats `countryId` as country of origin and validates the study chain independently: the city must be an active Chinese city and the university must be active, verified, and located in that city. Draft saves preserve progress; completed members can revisit `/onboarding` from Settings to update their context.

## Communities, posts, comments, and events

| Method   | Endpoint                                             | Auth/permission | Purpose |
| -------- | ---------------------------------------------------- | --------------- | ------- |
| `GET`    | `/api/communities`                                   | Public          | Paginated/searchable active public directory DTOs. |
| `POST`   | `/api/communities`                                   | Member          | Create a rate-limited reviewed community and its single owner membership. |
| `PATCH`  | `/api/communities/:id`                               | Owner/Admin     | Update identity, access policy, privacy, location, and validated cover media. |
| `DELETE` | `/api/communities/:id`                               | Owner/Admin     | Archive while preserving membership, content, reports, and audit history. |
| `POST`   | `/api/communities/:id/members`                       | Member          | Join, request access, or accept a pending invitation according to policy. |
| `DELETE` | `/api/communities/:id/members`                       | Member          | Leave unless the actor is the current owner. |
| `PATCH`  | `/api/communities/:id/members/:memberId`             | Owner/Admin     | Promote or demote Member/Moderator roles. |
| `DELETE` | `/api/communities/:id/members/:memberId`             | Staff/Admin     | Remove a member with owner/moderator separation. |
| `POST`   | `/api/communities/:id/transfer`                      | Owner/Admin     | Transfer ownership atomically to an existing member. |
| `POST`   | `/api/communities/:id/invitations`                   | Staff/Admin     | Invite an active member by email and enqueue notification. |
| `PATCH`  | `/api/communities/:id/access/:requestId`             | Staff/Admin     | Approve or reject a pending access request. |
| `DELETE` | `/api/communities/:id/access/:requestId`             | Request owner   | Cancel the current member's pending request. |
| `POST`   | `/api/communities/:id/report`                        | Member          | Create/reuse an active community report with immutable evidence. |
| `POST`   | `/api/posts`                                         | Member          | Create discussion, question, event, or staff announcement with up to four validated images. |
| `PATCH`  | `/api/posts/:id`                                     | Author/Admin    | Edit a live post; member event edits return to validation. |
| `DELETE` | `/api/posts/:id`                                     | Author/Staff    | Soft-remove a post and unpin it. |
| `POST`   | `/api/posts/:id/moderation`                          | Staff/Admin     | Pin, unpin, validate event, publish, remove, or restore. |
| `POST`   | `/api/posts/:id/comments`                            | Member          | Create a comment or reply and enqueue transactional notifications. |
| `PATCH`  | `/api/comments/:id`                                  | Author          | Edit a published comment. |
| `DELETE` | `/api/comments/:id`                                  | Author/Staff    | Soft-remove a comment. |
| `POST`   | `/api/comments/:id/reactions`                        | Member          | Add an idempotent typed comment reaction. |
| `DELETE` | `/api/comments/:id/reactions`                        | Member          | Remove a typed comment reaction. |
| `POST`   | `/api/posts/:id/report`, `/api/comments/:id/report`  | Member          | Create/reuse preserved content reports. |

Community visibility requires an active public community, membership, or a pending invitation. Owners and members may continue to access their non-removed reviewed/archived communities; `REMOVED` remains hidden outside exact Admin operations. Invitation-only private communities are visible to their pending invitee so the invitation can be accepted. Member-created events remain `PENDING_REVIEW` until staff validation; only validated events are published to normal event surfaces.

All domain mutations execute with their mandatory AuditLog in one transaction. Community/post media must be owned, `ACTIVE/CLEAN`, purpose-compatible Module 5 assets. Report evidence retains content snapshots and referenced media while role-based evidence serialization hides author identity and media IDs from Moderators.

## Marketplace

| Method   | Endpoint                                 | Auth/permission           | Purpose                                                                  |
| -------- | ----------------------------------------- | -------------------------- | ------------------------------------------------------------------------ |
| `GET`    | `/api/marketplace`                       | Public                     | Paginated active listings with `category`, `city`, price, `q`, and `sort` filters. |
| `POST`   | `/api/marketplace`                       | Member                     | Create a listing with up to 8 validated Module 5 images. Fraud-scored; high-risk listings hold in `DRAFT` for review. Rate limited to 10/day. |
| `PATCH`  | `/api/marketplace/:id`                   | Seller/Admin                | Edit title, description, price, category, city, images, or expiry.       |
| `POST`   | `/api/marketplace/:id/status`            | Seller/Admin                | Transition lifecycle status (`DRAFT`/`ACTIVE`/`RESERVED`/`SOLD`/`ARCHIVED`) through the enforced seller state machine. |
| `POST`   | `/api/marketplace/:id/favorites`         | Member                     | Save a listing idempotently.                                             |
| `DELETE` | `/api/marketplace/:id/favorites`         | Member                     | Remove a saved listing.                                                  |
| `POST`   | `/api/marketplace/:id/report`            | Member                     | Create/reuse an active listing report with immutable evidence and retained media. Rate limited to 12/day. |
| `POST`   | `/api/internal/marketplace/expire`       | Worker secret               | Expire past-due `ACTIVE`/`RESERVED` listings and notify sellers. Intended for a scheduled invocation of `npm run marketplace:expire`. |
| `GET`    | `/api/admin/marketplace`                 | `MARKETPLACE_CMS_VIEW`      | Paginated/searchable/flagged listing inventory for staff.                |
| `GET`    | `/api/admin/marketplace/:id`             | `MARKETPLACE_CMS_VIEW`      | Full listing detail including fraud signals and legacy-image status.     |
| `PATCH`  | `/api/admin/marketplace/:id`             | `MARKETPLACE_CMS_MANAGE`    | Override status, mark fraud reviewed, and record a moderation note. Atomic audit. |
| `GET`    | `/api/admin/marketplace/categories`      | `MARKETPLACE_CMS_VIEW`      | List all categories including inactive ones.                             |
| `POST`   | `/api/admin/marketplace/categories`      | `MARKETPLACE_CMS_MANAGE`    | Create or update a category. Atomic audit.                               |
| `DELETE` | `/api/admin/marketplace/categories/:id`  | `MARKETPLACE_CMS_MANAGE`    | Delete an unused category; rejected while listings still reference it.   |

Kondo does not accept, initiate, authorize, record, or settle a payment. Contact between buyer and seller uses the Module 10 messaging boundary; a rule-based fraud scorer flags advance-payment, gift-card/crypto, off-platform-payment, pressure language, external links, and multiple-contact-number signals, holding listings scoring 70+ in `DRAFT` until reviewed.

A listing must carry at least one validated Module 5 image to become or remain `ACTIVE`. Normal listing pages, Search results, profile counts/lists, favorites, bookmarks, and the Marketplace contact message producer accept only listings that are `ACTIVE`, unexpired, and in an active category; other lifecycle states return `404` outside seller/Admin surfaces. A scheduled worker transitions past-due listings to `EXPIRED` and notifies the seller and any users who favorited it.

## Messages and safety

| Method   | Endpoint                          | Auth   | Purpose                                                                  |
| -------- | --------------------------------- | ------ | ------------------------------------------------------------------------ |
| `POST`   | `/api/messages`                   | Member | Send first text/media and atomically create or reuse a direct thread.     |
| `POST`   | `/api/conversations/:id/messages` | Member | Send text/media in a direct conversation the current user participates in. |
| `PATCH`  | `/api/conversations/:id/read`     | Member | Advance read state to a validated displayed `latestMessageId`.           |
| `PATCH`  | `/api/conversations/:id`          | Member | Archive or restore the current participant's conversation entry.         |
| `DELETE` | `/api/conversations/:id`          | Member | Hide current history for this participant without destroying shared data. |
| `POST`   | `/api/conversations/:id/report`   | Member | Create or reuse an active conversation report and preserve evidence.     |
| `POST`   | `/api/users/:id/block`            | Member | Block a user idempotently and prevent messages in either direction.      |
| `DELETE` | `/api/users/:id/block`            | Member | Remove the current user's block relationship.                            |

Each send requires trimmed text up to 2,000 characters, one active validated `MESSAGE_IMAGE`/`MESSAGE_DOCUMENT`, or both. Images accept JPG/PNG/WebP up to 8 MB with alt text; documents accept constrained PDF up to 10 MB. Media attaches atomically to the conversation/message and responses expose only stable media delivery IDs. General sends are limited to 30 per minute per process, new-recipient conversations to 8 per hour, identical rapid text duplicates are rejected, and reports/blocks have separate limits. Every mutation requires a valid same-origin session.

Inbox and history reads are server-paginated. Unread state advances only to the supplied message that belongs to the conversation, preventing a page open from marking later unseen messages as read. Archive is participant-local. Delete-for-me hides existing history for that participant, writes AuditLog, and preserves the shared message/media records plus immutable report evidence; a later message makes the thread reappear without restoring the cleared history.

Block, unblock, clear, and report creation retain their required safety boundaries. Conversation reporting requires participation, returns `201 { reportId }` for a new case and `200 { reportId }` when reusing the existing active case, and captures the latest 50 messages as restricted evidence. Notifications remain outbox-based and are created asynchronously from the same message transaction.

## Media

| Method   | Endpoint                          | Auth             | Purpose                                                               |
| -------- | --------------------------------- | ---------------- | --------------------------------------------------------------------- |
| `POST`   | `/api/media/uploads`              | Member           | Create a signed, rate-limited upload authorization and server key.    |
| `PUT`    | `/api/media/uploads/:id/content`  | Signed upload    | Write exact authorized bytes to the local development storage driver. |
| `POST`   | `/api/media/uploads/:id/complete` | Owner            | Read back, validate, checksum, and activate uploaded bytes.           |
| `GET`    | `/api/media/:id`                  | Visibility rules | Deliver active clean media without exposing its provider object key.  |
| `PATCH`  | `/api/media/:id`                  | Owner            | Update accessible alt text on an active image.                        |
| `DELETE` | `/api/media/:id`                  | Owner            | Disable delivery and schedule physical object deletion.               |

The upload authorization binds asset ID, owner, generated object key, MIME, exact size, and a ten-minute expiry. Local development receives a signed header target; S3-compatible production receives a presigned private-bucket `PUT`. Completion trusts neither request metadata nor storage metadata: it verifies exact byte count, magic MIME, allowed extension, purpose policy, image decoding/frame/dimension limits or constrained PDF structure, content-safety markers, and SHA-256 checksum before returning an `ACTIVE` DTO.

Public active media can be delivered anonymously. Private media requires its owner, an authorized conversation participant after attachment, or the `MEDIA_VIEW` Admin permission. Documents force download with a sandbox response policy. Removed, rejected, pending, unauthorized, and missing media return `404` from delivery.

## Profiles and account requests

| Method   | Endpoint                    | Auth       | Purpose                                                                     |
| -------- | --------------------------- | ---------- | --------------------------------------------------------------------------- |
| `GET`    | `/api/profile`              | Member     | Return the owner's editable profile settings and active account requests.   |
| `PATCH`  | `/api/profile`              | Member     | Update validated profile fields, audiences, and avatar attachment atomically. |
| `GET`    | `/api/profiles/:id`         | Visibility | Return the stable versioned profile DTO permitted for the current viewer.   |
| `POST`   | `/api/profiles/:id/report`  | Member     | Create or reuse an active profile report with a preserved profile snapshot. |
| `GET`    | `/api/account/requests`     | Member     | List the current member's export and deletion requests.                     |
| `POST`   | `/api/account/requests`     | Member     | Create or reuse an active data-export or account-deletion request.          |
| `DELETE` | `/api/account/requests/:id` | Owner      | Cancel a pending account request.                                           |

Profile sections use independent `PUBLIC`, `MEMBERS`, or `PRIVATE` audiences. Anonymous viewers receive only public profiles/sections; authenticated members may receive member-visible sections; private sections remain owner/Admin-only. The response includes only explicit public identity, permitted study context, visible activity, visible active listings, permitted community memberships, and counters computed from the same visibility policy.

Avatar uploads use Module 5's private `PROFILE_AVATAR` media. Attaching, replacing, or removing an avatar is validated and audited atomically. A reported avatar is retained for authorized evidence review even if the member later replaces it; it is not exposed through normal profile delivery.

## Settings and sessions

| Method   | Endpoint                     | Auth   | Purpose                                                                  |
| -------- | ---------------------------- | ------ | ------------------------------------------------------------------------ |
| `GET`    | `/api/settings`              | Member | Return safe persisted theme, language, notification, and digest settings. |
| `PATCH`  | `/api/settings`              | Member | Persist one or more validated preferences atomically with AuditLog.       |
| `GET`    | `/api/settings/sessions`     | Member | List safe active-device DTOs and identify the current database session.   |
| `DELETE` | `/api/settings/sessions`     | Member | Revoke all other sessions or every session for the current member.        |
| `DELETE` | `/api/settings/sessions/:id` | Owner  | Revoke one owned session, including the current session when selected.    |

Preference writes require the trusted same origin and never return raw Prisma records. Missing preference rows resolve to `SYSTEM`, `ENGLISH`, enabled in-app categories, and `NEVER` email digest. Theme choices are applied through `next-themes` and persisted server-side; selecting a non-English language records intent but does not claim that untranslated product surfaces are complete.

Session responses exclude token hashes, raw IP addresses, and raw user-agent strings. Revocation is immediate because the database session row is removed in the same transaction as its mandatory AuditLog. Revoking the current session or all sessions also clears the host-only session cookie.

## Admin operations

All Admin endpoints require an active session and an exact server-side permission. Mutation endpoints also require a trusted same origin. Responses are private and non-cacheable, vary by session cookie, and use explicit moderation DTOs; they never serialize raw Prisma records, internal note relations, secret object keys, or unauthorized security metadata.

| Method   | Endpoint                              | Permission                   | Purpose                                                                               |
| -------- | ------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------- |
| `GET`    | `/api/admin/reports`                  | `REPORT_LIST`                | Paginated report queue with status, reason, target, assignee, and query filters.      |
| `GET`    | `/api/admin/reports/:id`              | `REPORT_VIEW`                | Role-scoped case detail, internal notes, permitted evidence, and case audit timeline. |
| `POST`   | `/api/admin/reports/:id/assignment`   | `REPORT_CLAIM`               | Claim, assign, reassign, or unassign with an expected report version.                 |
| `POST`   | `/api/admin/reports/:id/notes`        | `REPORT_ADD_NOTE`            | Add an internal note to a case the actor may operate.                                 |
| `POST`   | `/api/admin/reports/:id/transition`   | `REPORT_TRANSITION_ASSIGNED` | Review, resolve, dismiss, or perform an authorized controlled reopening.              |
| `GET`    | `/api/admin/audit`                    | `AUDIT_VIEW_GLOBAL`          | Paginated AuditLog browser with action, entity, actor, and free-text filters.         |
| `GET`    | `/api/admin/reference-data/:type`     | `REFERENCE_DATA_VIEW`        | Paginated countries, cities, or universities using explicit operational DTOs.         |
| `POST`   | `/api/admin/reference-data/:type`     | `REFERENCE_DATA_MANAGE`      | Create an audited country, city, or university.                                       |
| `PATCH`  | `/api/admin/reference-data/:type/:id` | `REFERENCE_DATA_MANAGE`      | Update lifecycle, verification, identity, or parent location with audit.              |
| `DELETE` | `/api/admin/reference-data/:type/:id` | `REFERENCE_DATA_MANAGE`      | Delete an unused record; referenced records return `409`.                             |
| `GET`    | `/api/admin/media`                    | `MEDIA_VIEW`                 | Paginated media inspection with status, purpose, owner, and free-text filters.        |
| `GET`    | `/api/admin/media/:id`                | `MEDIA_VIEW`                 | Safe media metadata and its bounded audit timeline; storage keys remain hidden.       |
| `DELETE` | `/api/admin/media/:id`                | `MEDIA_MANAGE`               | Remove delivery with a required reason and atomic AuditLog entry.                     |
| `GET`    | `/api/admin/users`                    | `USER_VIEW`                  | Paginated safe user review with account/profile filters and explicit DTOs.            |
| `GET`    | `/api/admin/users/:id`                | `USER_VIEW`                  | Safe operational user detail, profile audiences, account requests, and bounded audit. |
| `PATCH`  | `/api/admin/account-requests/:id`     | `ACCOUNT_REQUEST_MANAGE`     | Version-guarded processing, completion, or rejection with mandatory resolution.       |
| `GET`    | `/api/admin/notifications`            | `NOTIFICATION_VIEW`          | Template, announcement, queue, delivery, skip, retry, and failure diagnostics.         |
| `POST`   | `/api/admin/notifications`            | `NOTIFICATION_MANAGE`        | Queue one audited in-app product announcement for active members.                     |
| `PATCH`  | `/api/admin/notifications/templates/:key` | `NOTIFICATION_MANAGE`    | Version-guarded bounded template update with mandatory AuditLog.                       |
| `GET`    | `/api/admin/message-safety`           | `MESSAGE_SAFETY_VIEW`    | Aggregate messaging health and report references without raw conversation access.     |
| `GET`    | `/api/admin/communities`              | `COMMUNITY_CMS_VIEW`     | Paginated community CMS with status, type, owner, activity, and query filters.          |
| `GET`    | `/api/admin/communities/:id`          | `COMMUNITY_CMS_VIEW`     | Safe community, member, request, and content operations detail.                         |
| `PATCH`  | `/api/admin/communities/:id`          | `COMMUNITY_CMS_MANAGE`   | Activate, archive, remove, restore review state, or change platform verification.       |

`MODERATOR` can list unassigned/self-assigned cases, claim an unassigned case, add notes and decide self-assigned cases, view redacted evidence, and inspect that case's audit timeline. `ADMIN` can access the platform overview, assign/reassign/unassign any active case, reopen terminal cases, view full operational evidence, and browse global AuditLog records. `SUPER_ADMIN` additionally sees stable evidence identifiers and request IP/user-agent metadata.

Reference-data viewing and management are restricted to `ADMIN` and `SUPER_ADMIN`. `MODERATOR` and `MEMBER` receive no reference-data Admin access. University country is derived from the selected city; deletes are blocked while users, communities, listings, cities, or universities depend on the record.

Media viewing and management are also restricted to `ADMIN` and `SUPER_ADMIN`. Admin removal preserves metadata and audit history, hides the object immediately from delivery, and records provider cleanup for retry when deletion fails.

User review and account-request processing are restricted to `ADMIN` and `SUPER_ADMIN`; Moderators do not receive profile-private fields or account-request operations. Admin responses exclude password hashes, sessions, OAuth secrets, raw media records, and provider object keys.

Notification administration is Admin/Super Admin only. Template keys/types and allowed variables are fixed; safety-result notifications cannot be disabled, announcements are rate limited, and diagnostics omit recipients, payload data, email addresses, and raw worker errors.

Message safety administration is Admin/Super Admin only. It exposes aggregate direct-thread, recent-volume, attachment, block, report, archive, and clear counts plus safe report references. It intentionally offers no raw-conversation browser; message evidence remains available only through a member-created report and its role-redacted case view.

Assignment and transition payloads include `expectedVersion`. A stale version, concurrent claim, invalid lifecycle transition, or attempted assignment of a closed case returns `409`. Missing reports/eligible assignees return `404`; role or case-scope violations return `403`. Terminal transitions require a status-compatible `decision` and a 10–2,000 character `resolution`.

## Guides and search

| Method   | Endpoint                       | Auth   | Purpose                                                                   |
| -------- | ------------------------------ | ------ | ------------------------------------------------------------------------- |
| `PUT`    | `/api/guides/progress/:stepId` | Member | Complete a step only when its parent guide is published.                  |
| `DELETE` | `/api/guides/progress/:stepId` | Member | Clear progress only when its parent guide is published.                   |
| `GET`    | `/api/search?q=`               | Member | Search visible content with safe DTOs. Rate limited and private/no-store. |

Search uses explicit Prisma selections and stable response DTOs. Public user and post-author projections contain only `id`, `username`, `firstName`, and `lastName`; the user result adds only the non-sensitive country emoji and current affiliation required by the existing interface. Inactive users, inaccessible private communities/posts, non-active listings, unpublished guides, and unpublished questions are excluded.

## Bookmarks and notifications

| Method   | Endpoint                               | Auth   | Purpose                                                     |
| -------- | -------------------------------------- | ------ | ----------------------------------------------------------- |
| `GET`    | `/api/bookmarks/:targetType/:targetId` | Member | Return bookmark state only for a currently visible target.  |
| `PUT`    | `/api/bookmarks/:targetType/:targetId` | Member | Save a currently visible post, listing, guide, or question. |
| `DELETE` | `/api/bookmarks/:targetType/:targetId` | Member | Remove the current member's bookmark for the target.        |
| `GET`    | `/api/notifications`                   | Member | Paginated safe DTOs and real unread count.                 |
| `GET`    | `/api/notifications/unread-count`      | Member | Real visible unread count.                                 |
| `PATCH`  | `/api/notifications/:id/read`          | Owner  | Mark one visible notification read.                        |
| `PATCH`  | `/api/notifications/read-all`          | Member | Mark every visible unread notification read.               |
| `DELETE` | `/api/notifications/:id`               | Owner  | Soft-hide one notification.                                |

Links are restricted to approved internal routes. Producers enqueue a deduplicated PostgreSQL outbox job in the source transaction; the worker applies current preferences and templates. Messages, Q&A replies, Marketplace contacts, and moderation results are live producers. The Comment producer is ready for Module 11's real mutation.

`POST /api/internal/notifications/process` requires the exact `Authorization: Bearer $NOTIFICATION_WORKER_SECRET` header and processes a bounded batch. Operators can run the same worker with `npm run notifications:process`.

## Help center

| Method   | Endpoint                     | Auth   | Purpose                                                   |
| -------- | ---------------------------- | ------ | --------------------------------------------------------- |
| `POST`   | `/api/questions`             | Member | Publish a categorized help-center question. Rate limited. |
| `POST`   | `/api/questions/:id/answers` | Member | Answer a published question. Rate limited.                |
| `PUT`    | `/api/answers/:id/votes`     | Member | Mark an answer helpful idempotently.                      |
| `DELETE` | `/api/answers/:id/votes`     | Member | Remove the current member's helpful vote.                 |

Question pages, previews, answers, bookmarks, and Search expose only `PUBLISHED` questions. Helpful votes require both a `PUBLISHED` answer and a `PUBLISHED` parent question.

## Standard statuses

- `200`: successful read or idempotent mutation.
- `201`: resource created.
- `204`: resource deleted with no body.
- `400`: malformed or invalid data.
- `401`: valid session required.
- `403`: authorization or origin check failed.
- `404`: resource missing, unpublished, inactive, or intentionally hidden by a visibility rule.
- `409`: unique identity, optimistic-version, concurrent-claim, or lifecycle conflict.
- `429`: rate limit exceeded.

## Planned endpoints

The roadmap next prioritizes shared rate limits, cursor/full-text search, and later editorial CMS modules. These must follow the same validation, authorization, audit, evidence-retention, and rate-limit patterns already established through Module 12.
