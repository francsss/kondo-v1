# Kondo Security

## Implemented controls

### Identity and sessions

- Passwords use bcrypt with cost 12 and a strong-password validation policy.
- The browser receives a signed JWT in an HTTP-only cookie; the token includes a random session identifier, not credentials.
- Only the SHA-256 hash of the random session identifier is stored in PostgreSQL.
- Every authenticated request verifies the signature, database session, user identity, status, and expiry. The session lookup joins the current database user, so `SUSPENDED` and `DEACTIVATED` users are rejected and database role changes apply immediately even when an older JWT contains a previous role.
- Revoked session rows fail immediately. Expired session rows are rejected and deleted opportunistically when presented.
- Logout revokes the database record before clearing the browser cookie.
- Successful login writes the new session and `LOGIN_SUCCESS` audit record atomically. Registration creates the user, session, and `USER_REGISTERED` audit record atomically.
- Cookies are host-only and use `HttpOnly`, `SameSite=Lax`, a root path, and a seven-day maximum age. `Secure` requires both production mode and an effective HTTPS request; it is omitted for local HTTP on `localhost` and private LAN IPs, while Vercel's HTTPS forwarding enables it.
- Cookie creation and deletion use the same name, path, SameSite, and request-aware transport settings; deletion additionally sets an epoch expiry and `Max-Age=0`.
- Settings can revoke one owned session, every other session, or every session. Current/all-session revocation also clears the session cookie; ownership is rechecked from the authenticated database user.
- Next.js development assets allow the private `192.168.x.x` range required for LAN testing. The application remains protected by the host firewall, same-origin mutation checks, and the development-only scope of `allowedDevOrigins`.
- Authentication forms declare explicit POST actions, preventing passwords from falling back to URL query parameters if client hydration is unavailable.
- The `OAuthAccount` model supports provider linking without changing user authorization; no provider is wired yet.
- Email-verification and password-reset tokens are cryptographically random (32 bytes), single-use, expiring (24h/1h), and stored only as a SHA-256 hash — the raw token exists only in the outbound email and, outside production, in the API response for local testing. Requesting a new token invalidates any unused prior token for the same user.
- Password-reset confirmation revokes every session for that user in the same transaction as the password change, so a stolen session cannot survive a reset.
- Password-reset requests always return the same generic response and take a comparable code path whether or not the email matches an account, and are rate limited per email (5/hour), so the endpoint cannot be used to enumerate registered addresses.

### Authorization and moderation

- Global roles are `MEMBER`, `MODERATOR`, `ADMIN`, and `SUPER_ADMIN`; operational capabilities are assigned through an explicit permission matrix rather than broad client-side role checks.
- Community membership has separate `MEMBER`, `MODERATOR`, and `OWNER` roles.
- Admin pages and APIs are server-gated per permission. `MODERATOR` handles unassigned/self-assigned reports with redacted evidence; `ADMIN` can assign/reassign/unassign, reopen, view full operational evidence, and browse global audit records; `SUPER_ADMIN` additionally sees stable evidence identifiers and request security metadata.
- Moderators cannot access the platform-wide overview, other moderators' assigned cases, global AuditLog browser, full identity-bearing evidence, reassignment, or reopening.
- Only Admin and Super Admin receive `REFERENCE_DATA_VIEW` and `REFERENCE_DATA_MANAGE`; Moderator and Member cannot read or mutate operational reference data.
- Only Admin and Super Admin receive `MEDIA_VIEW` and `MEDIA_MANAGE`; Moderator and Member cannot inspect the global media inventory or perform administrative removal.
- Only Admin and Super Admin receive `COMMUNITY_CMS_VIEW` and `COMMUNITY_CMS_MANAGE`. Community OWNER/MODERATOR capabilities are separate local roles and are rechecked server-side for every scoped mutation.
- Only Admin and Super Admin receive `USER_MANAGE`. An Admin cannot change their own account status or revoke their own sessions through this control, and cannot act on a Super Admin's status or sessions at all — only another Super Admin can, preventing a compromised or malicious Admin account from disabling account-management oversight of itself or of Super Admins.
- Suspending or deactivating an account revokes every one of its sessions in the same transaction as the status change, so a live session cannot outlive a suspension.
- Only Admin and Super Admin receive `GUIDE_CMS_VIEW` and `GUIDE_CMS_MANAGE`; Moderator and Member cannot create, edit, or publish guide content. A guide cannot publish with zero steps, and cannot be deleted while published or while any step has recorded member progress.
- PostgreSQL enforces one community owner membership, a required owner/member reference, and synchronous protection against removing or demoting the currently referenced owner. Ownership transfer is atomic and audited.
- Typed content-visibility policies enforce public-or-member access for private communities and their posts/comments. Ordinary directories and Search never use the moderation override; direct private-community access may use the already-existing global moderation capability.
- Normal user surfaces expose only `PUBLISHED` posts, questions, answers, and guides, and only `ACTIVE` marketplace listings. Hidden or unavailable resources return `404` to avoid confirming existence.
- Report lifecycle is enforced server-side as `OPEN → REVIEWING → RESOLVED|DISMISSED`; terminal reopening requires Admin permission and a recorded reason. Status-compatible decisions and meaningful resolutions are mandatory.
- Report assignment and transitions use optimistic versions to reject stale writes. PostgreSQL prevents concurrent duplicate active conversation reports, while version-guarded updates prevent concurrent double claims.
- Report creation preserves a bounded conversation snapshot. Member APIs never expose evidence or internal notes. Inside the evidence snapshot, Moderator receives generic participant labels without stable user/message identifiers or usernames, Admin receives operational identity and attachment metadata, and only Super Admin receives stable evidence IDs and IP/user-agent metadata.

### Request and response safety

- Zod validates registration, login, onboarding, post, reaction, marketplace, question, answer, message, and conversation-report payloads.
- Onboarding performs database-backed validation after Zod: origin country, study city, and university must be active; the university must be verified and belong to the selected city and country.
- PostgreSQL triggers reject direct University country/city mismatches and User city/university mismatches. Parent corrections synchronize only the derived location IDs.
- Bookmark reads and mutations verify that their polymorphic target type is allowed and the target is currently visible before exposing or persisting state.
- Listing favorites, answer votes, guide progress, and post reactions verify target existence, lifecycle state, parent state where applicable, and community access before writing.
- State-changing routes compare `Origin` with the forwarded/current host.
- Auth, search, post, and listing endpoints use rate limits.
- Messaging adds layered abuse controls: a general send limit, a stricter new-recipient limit, rapid identical-message rejection, participation checks, active-recipient checks, and a 2,000-character maximum.
- Either direction of a block prevents new messages while preserving existing conversation evidence. Members can report only conversations they participate in; duplicate active reports are reused and block/unblock/report actions are audited atomically with their mutation.
- PostgreSQL enforces canonical DIRECT participant identity, prevents a third participant, validates the two-member transaction, and prevents physical user deletion from leaving a one-member thread.
- Message read state advances only to a validated message ID in the participant's conversation. Archive and delete-for-me are participant-local; clearing writes an audit and never destroys shared messages or immutable report evidence.
- Message images/PDFs must pass Module 5 ownership, purpose, byte-validation, MIME, size, scan, and active-state checks before the same transaction attaches them to a conversation and message. Private delivery requires owner, current participant, or exact media operations permission.
- `MESSAGE_SAFETY_VIEW` is Admin/Super Admin only and returns aggregate health plus report references. No role receives a general private-conversation browser; Moderator/Admin/Super Admin evidence access remains bound to a report and redacted by existing case permissions.
- Community creation, invitations, access requests, posts, comments, and content reports use bounded rate limits where abuse risk is material. Announcement, event-approval, access, and comment notifications enter the transactional PostgreSQL outbox.
- Community/post/comment reports reuse an active case under concurrency, capture immutable content/author/media evidence, and retain clean media. Member APIs expose neither evidence nor internal notes; Moderator evidence hides stable identifiers, author identity, and media IDs.
- Private invitation-only communities are visible only to members, exact Admin operations, or the invited user with a pending invitation. Removed communities remain hidden from member visibility paths.
- Admin assignment, reassignment, unassignment, notes, review, resolution, dismissal, and reopening are audited in the same PostgreSQL transaction. A failed audit insert rolls back the corresponding report mutation.
- Country, city, and university create/update/delete actions are audited in the same transaction. A failed audit insert rolls back the reference mutation.
- Media upload authorization, activation/rejection, alt-text changes, replacement, owner removal, Admin removal, expiry, and orphan cleanup are audited. Admin removal and its AuditLog insert share one transaction.
- Upload object keys are generated only by the server and never returned in media DTOs or Admin APIs. Signed upload claims bind the owner, asset, key, MIME, byte count, and expiry.
- Uploaded bytes remain private and non-deliverable until the server reads them back and validates exact size, magic MIME, extension, purpose limits, image decoding/dimensions/frame count or constrained PDF structure, unsafe PDF actions/embedded files, the EICAR test marker, and a SHA-256 checksum.
- Public media delivery accepts only `ACTIVE/CLEAN` records. Private media additionally requires ownership, authorized conversation participation after attachment, or the exact Admin media-view permission. Missing and unauthorized delivery use the same `404` response.
- Profile avatars remain private media and are delivered only when the requesting viewer satisfies the owning profile's audience. Owner and exact Admin profile/media permissions are checked server-side.
- Profile responses use an explicit versioned serializer and field-group audience checks. Email, phone, role, account status, sessions, OAuth data, internal timestamps, and hidden-section counts are not exposed to other members.
- Profile reports preserve an immutable bounded profile snapshot. If the captured avatar is later replaced or removed, retention metadata prevents physical deletion while authorized Admin evidence delivery remains permission-gated.
- Data-export and account-deletion requests use one active request per type/member, optimistic versions, exact Admin permissions, and mandatory transactional AuditLog entries.
- Preference writes and session revocations require trusted origin, validated payloads, an active database session, and a mandatory AuditLog in the same transaction.
- Session-management DTOs never expose token hashes, raw IP addresses, or raw user-agent strings. Device labels are derived server-side from bounded existing metadata.
- Local filesystem storage is development/test only and rejects production configuration. Production uses a private S3-compatible bucket through least-privilege credentials and presigned writes.
- Removal disables delivery before physical deletion. Failed provider deletions are retained as `storageDeletePending` and retried by the cleanup task; metadata and audit history are not erased.
- Audit value serialization recursively redacts password, session/token, OAuth-token, and attachment-object-key fields before any Admin response.
- Admin API responses are marked `private, no-store` and vary by the session cookie so operational data cannot enter shared caches.
- Messages accept escaped plain text/emoji, validated JPG/PNG/WebP images, and constrained PDFs. Message DTOs expose media IDs and bounded display metadata only, never provider keys, upload signatures, checksums, or raw media records.
- Route errors are generic and do not disclose account existence, password state, SQL, or stack traces.
- Failed-login AuditLogs use a SHA-256 credential identifier instead of an email address. Structured server error logs contain only an event name and error classification; Prisma query/error console logging is disabled to avoid accidental parameter disclosure.
- Security headers include CSP, frame denial, MIME sniff prevention, a strict referrer policy, and a restrictive permissions policy.
- Prisma parameterizes database queries.
- React escapes rendered user text; user-authored HTML is not accepted.

### Marketplace trust and safety

- A rule-based fraud scorer flags advance-payment, gift-card/crypto, off-platform-payment, pressure-language, external-link, multiple-contact-number, and zero-price signals in listing text; listings scoring 70+ are held in `DRAFT` and cannot self-publish until an Admin marks them fraud-reviewed.
- The seller-facing lifecycle is a server-enforced state machine (`DRAFT → ACTIVE → RESERVED/SOLD/ARCHIVED`, `EXPIRED → ACTIVE/ARCHIVED`); only `MARKETPLACE_CMS_MANAGE` can bypass the transition graph.
- `ACTIVE` requires at least one owned `ACTIVE/CLEAN` Module 5 image and an active category; a listing with zero images cannot publish or remain published.
- A scheduled worker (`/api/internal/marketplace/expire`, secret-gated) transitions past-due `ACTIVE`/`RESERVED` listings to `EXPIRED` idempotently and notifies the seller and any users who favorited it.
- Listing reports reuse an active case under concurrency, capture an immutable snapshot (title, description, price, seller identity, media IDs), and retain referenced clean media as report evidence; Moderator evidence hides seller identity and media IDs, Admin/Super Admin retain them.
- Only Admin and Super Admin receive `MARKETPLACE_CMS_VIEW` and `MARKETPLACE_CMS_MANAGE`; Moderator and Member cannot browse the admin listing inventory or override lifecycle/fraud state.
- Listing creation is rate limited to 10/day per member; listing reports are rate limited to 12/day per member.
- Normal listing pages, Search results, profile counts/lists, favorites, bookmarks, and the Marketplace contact message producer accept only listings that are `ACTIVE`, unexpired, and in an active category.

### Data minimization

- Profiles collect only student-relevant identity and study context.
- Profile audience preferences default to member visibility; anonymous public exposure requires an explicit `PUBLIC` selection. The whole-profile audience is checked before any section-specific audience.
- Search is authenticated and returns stable explicit DTOs rather than Prisma objects. Its public user serializer allows only `id`, `username`, `firstName`, and `lastName`; user search adds only the country emoji and affiliation needed by the existing UI.
- Search never exposes password hashes, email, phone, roles, statuses, verification/account lifecycle fields, sessions, OAuth metadata, or internal timestamps, and excludes inactive users.
- Full-text search only ever supplies candidate row IDs and a relevance score. Every candidate is re-checked through the same typed content-visibility policy used elsewhere (community membership, published state, active listing state) before its safe DTO is built; a full-text match by itself can never surface a row that policy would otherwise hide. Cursor pagination for Search reuses this same policy on every page, not just the first.
- Bookmark visibility never grants a global moderator implicit access to a private-community post; membership is required on member-facing bookmark routes.
- Media records store provider-neutral object keys.
- Kondo has no payment, wallet, transfer, bank-integration, KYC, or settlement data in the MVP.

## Production launch gates

- Replace the in-memory rate limiter with a shared Redis-compatible implementation before multi-instance traffic.
- Encrypt OAuth tokens at rest or avoid storing provider access tokens when they are unnecessary.
- Add verified email delivery, password reset, device/session management, and suspicious-login alerts.
- Connect a managed malware-scanning service before enabling document types beyond the current constrained PDF policy or broad external document sharing.
- Schedule `npm run media:cleanup` in every deployed environment and alert on repeated `storageDeletePending` failures.
- Add automated dependency, secret, SAST, and container scanning in CI.
- Connect CSP reporting, application errors, audit anomalies, and database metrics to monitoring.
- Define privacy, retention, deletion, child-safety, moderation escalation, and law-enforcement request policies with counsel.
- Connect the account-request workflow to verified export generation, identity reauthentication, legal retention checks, and irreversible deletion execution before treating completion as automated.
- Notification preferences are enforced by the shared worker for Messages, Comments/Replies, Marketplace, and announcements. Safety moderation results cannot be suppressed or disabled.
- Producers write deduplicated outbox jobs atomically with source mutations. Concurrent enqueueing and delivery converge through database uniqueness.
- Links are checked against an internal-route allowlist at enqueue and serialization. External, protocol-relative, Admin, traversal, backslash, and control-character links are rejected or hidden.
- Member DTOs exclude template data, dedupe keys, jobs, recipient metadata, raw errors, IP addresses, and worker locks.
- The worker endpoint uses a separate secret with timing-safe comparison. Jobs retry three times, recover stale locks, and store bounded error codes.
- The Module 16 digest worker (`/api/internal/notifications/digest`) reuses that same worker-secret, timing-safe-comparison pattern. Digest emails contain only an unread count and a link back to `/notifications`; suspended/deactivated accounts are skipped even if their digest interval has elapsed.
- Template and announcement mutations require exact Admin permissions, trusted origin, validation, rate limits, and transactional AuditLog.
- Add browser-driven end-to-end coverage for responsive Admin interactions; PostgreSQL integration and API-level report-to-resolution coverage are implemented.
- Move message, new-conversation, block, and report limits to the shared Redis-compatible store before multi-instance messaging traffic.

## Known dependency advisory

At the time of this version, the stable Next.js 16.2.10 package pins an internal PostCSS version affected by a moderate advisory. The issue remains in the production audit because overriding the framework-pinned copy creates an invalid dependency tree. Track the stable Next.js release that updates this dependency and upgrade promptly. Do not use `npm audit fix --force`, because npm proposes an unrelated breaking downgrade.

## Secret handling

- Never commit `.env` or provider credentials.
- Production `JWT_SECRET` must be at least 32 random bytes and rotated through the hosting secret manager.
- Database and object-storage credentials must be separate per environment with least privilege.
- Seed credentials are demo-only and must never exist in production data.

## Destructive seed protection

- `prisma/seed.ts` checks its environment before deleting any row.
- `KONDO_ALLOW_DESTRUCTIVE_SEED=true` is required for every intentional local/demo reset.
- `NODE_ENV=production` or `VERCEL_ENV=production` always blocks execution, even when the opt-in is present.
- Keep `KONDO_ALLOW_DESTRUCTIVE_SEED` unset or `false` in hosted environments. This release does not add a production reference-data seed system.
