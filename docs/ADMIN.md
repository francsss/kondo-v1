# Kondo administrator back office

## Entry point and security model

The administrator entry point is `/admin`. It uses the authenticated Kondo
application shell, including the current administrator profile, unread counts,
responsive navigation, and logout control.

Admin access is never inferred from a hidden link. `app/admin/layout.tsx`
requires `ADMIN_ACCESS` on the server, every page requires its exact permission,
and every mutation route calls `authorizeAdminApi()` again before validation or
database access. Mutations also require a trusted same-origin request. Database
sessions resolve the current role and account status on every request, so a
suspension, demotion, or session revocation takes effect immediately.

Roles:

| Role          | Access                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------- |
| `MEMBER`      | Public/member application only; no Admin access.                                              |
| `MODERATOR`   | Assigned report queue and redacted case evidence only.                                        |
| `ADMIN`       | Platform operations, CMS, users, reports, media, notifications, analytics, and safe settings. |
| `SUPER_ADMIN` | All Admin permissions, security metadata, and administrator-role assignment.                  |

Platform roles are separate from organization-membership roles. A global
`ADMIN` or `SUPER_ADMIN` does not become an organization owner through hidden
side effects, and an organization `OWNER`/`ADMIN` does not receive platform
Admin access. The organization foundation currently exposes operator setup and
settings only; organization verification review and team administration are
reserved for a later reviewed phase.

Only a Super Admin can assign or remove `ADMIN`/`SUPER_ADMIN` roles. An operator
cannot change their own role or status, so the acting administrator cannot
remove the platform's final active administrator through the UI. Role changes
revoke the target's sessions and create an `AuditLog` record.

## Routes

| Route                                 | Purpose                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `/admin`                              | Real operational overview, moderation queue, recent users, seven-day engagement, and recent audit activity.      |
| `/admin/users`                        | Search, role/status filters, pagination, account review, suspension/reactivation, sessions, and role assignment. |
| `/admin/communities`                  | User-community moderation plus creation and metadata management for explicitly official communities.             |
| `/admin/marketplace`                  | Listing search, status/fraud review, moderation, seller context, and category management.                        |
| `/admin/reports`                      | Central report queue, assignment, evidence, notes, decisions, and audit history.                                 |
| `/admin/message-safety`               | Aggregate safety diagnostics only; it does not expose private conversations.                                     |
| `/admin/city-hubs`                    | Multi-city editorial workflow and City Hub creation.                                                             |
| `/admin/city-hubs/:id`                | Navigation between independently managed City Hub details and existing sections.                                 |
| `/admin/city-hubs/:id/details`        | City identity, introduction, signals, and impact-point form.                                                     |
| `/admin/city-hubs/:id/sections/:slug` | One existing section with independently persisted settings and entry CRUD.                                       |
| `/admin/city-hubs/:id/preview`        | Protected preview of the current draft before publication.                                                       |
| `/admin/guides`                       | Student Hub guide and ordered-step CMS.                                                                          |
| `/admin/content`                      | Editorial index for Guides, City Hub, official communities, and validated community events.                      |
| `/admin/media`                        | R2-backed media inspection, validation status, retention, and safe removal.                                      |
| `/admin/notifications`                | Templates, targeted announcement composer, queue result, and worker diagnostics.                                 |
| `/admin/analytics`                    | Real 7/30/90-day database metrics and recorded product-event counts.                                             |
| `/admin/reference-data`               | Country, city, and university configuration.                                                                     |
| `/admin/settings`                     | Safe non-secret configuration index.                                                                             |
| `/admin/audit`                        | Filtered administrative audit history.                                                                           |

Student Hub administration intentionally remains under `/admin/guides`, because
the public Student Hub composes the Guide library, Q&A, and validated community
events. Events are not duplicated into a second model: editorial city events
are City Hub entries, while member/community events use the existing validated
`Post(type=EVENT)` lifecycle.

## First Super Admin

1. Register the intended administrator through the normal application flow.
2. Verify the account email and keep the account `ACTIVE`.
3. From a trusted operator environment configured with production
   `DATABASE_URL` and `DIRECT_URL`, run:

   ```bash
   npm run admin:bootstrap -- admin@example.com --confirm
   ```

4. Sign in again. The bootstrap refuses to run if an active Super Admin already
   exists. Later administrator assignments must use the reviewed user page.

## City Hub architecture

`CityHub` keeps two validated JSON snapshots:

- `draft` is the editable working copy;
- `published` is the immutable public snapshot written only on publication.

This preserves existing city data and the public `ExploreCity` contract without
a destructive normalization migration. `/admin/city-hubs/:id` is a navigation
page rather than one combined editor. City identity has its own form, every
existing section has its own management route, section settings save without
rewriting entries, and every typed entry (`company`, `product`, `university`,
`opportunity`, `event`, `service`, and `story`) has an independent create,
update, and delete operation. A targeted mutation reads the latest draft,
changes only its addressed object, uses an atomic optimistic-version guard, and
writes an AuditLog record. No other section must be submitted or validated to
save an entry. Type-specific guidance maps the supported fields—category,
location, status/date, tags, details, and official source—to each content type.
The complete `ExploreCity` Zod schema remains the publication integrity gate.

Workflow:

1. Create a draft, optionally seeded from the typed registry.
2. Open Hub details or one existing section from the navigation page.
3. Save details, section settings, or one entry independently with optimistic
   version checking. These operations accumulate in the working draft.
4. Preview through the protected draft-preview route.
5. Submit `DRAFT → REVIEW`.
6. Publish `REVIEW → PUBLISHED`; the validated draft replaces the public
   snapshot transactionally.
7. “Revise” returns to draft while retaining the last public snapshot.
8. “Unpublish” returns to draft and removes the public snapshot. A managed but
   unpublished city does not fall back to static content.

Unknown/unmanaged cities can still use the typed registry as a compatibility
fallback. Once a City Hub record exists, its publication state is authoritative.

### Add a city

Create the City and any Universities under `/admin/reference-data`, then create
a City Hub using a unique lowercase slug. No new route or page component is
needed. A new static registry file is optional and should only be used when a
temporary pre-CMS fallback is deliberately required.

### Add a City Hub content type

Extend `ExploreEntryType` in `src/features/explore/types.ts`, its Zod mirror in
`src/lib/validation.ts`, the editor guidance/defaults in
`CityHubSectionEditor.tsx`, and the public rendering behavior. Add validation
and public-visibility tests before publishing data of the new type.

## Images and files

All supported uploads use the existing two-phase media workflow and private
Cloudflare R2 bucket in production. The browser receives a short-lived upload
authorization, writes bytes directly to R2, and calls the completion route.
The server reads the object back, validates MIME signature, size, dimensions or
PDF structure, activates the `MediaAsset`, and serves it through
`/api/media/:id` after authorization.

Profile, community, post, Marketplace, message, and other currently supported
media purposes use this workflow. Student Hub guide covers use the relational
`Guide.coverMediaId` and `GUIDE_COVER` policy for upload, preview, replacement,
removal, and public delivery. City Hub entry images are not exposed as a
fake URL/base64 field because the current public `ExploreEntry` contract does
not render an image or own a relational media attachment. Add that relation and
its cleanup lifecycle before introducing City Hub images.

## Notifications

Announcements can target all active users or a persisted City, Community, or
University audience. Recipient IDs are resolved inside the creation
transaction, never supplied by the browser. The selected audience and label are
stored on `NotificationAnnouncement`, recipient count is shown to the operator,
delivery runs through the existing outbox worker, and no recipient identities
appear in diagnostics.

## Public visibility and cache behavior

- Marketplace pages query persisted, active, non-expired Neon rows.
- City Hub pages render only the validated published snapshot for managed
  cities; drafts and review versions are never returned publicly.
- Student Hub Guide pages query published Guides and ordered GuideSteps.
- Community events require a published post and the existing event validation.
- Media URLs remain stable application routes backed by R2 object keys.
- Signed-in product pages are dynamic. Mutations refresh the current router;
  no mutation depends on client-only state.

## Database migrations

Apply all migrations with `npx prisma migrate deploy` through the direct Neon
URL before deploying the application commit. Relevant additions include:

- `20260721100000_notification_announcement_audience`: additive JSON audience
  metadata for persisted announcement targeting;
- `20260721103000_official_communities`: additive `isOfficial` flag and index;
- `20260721110000_guide_cover_media`: additive secure Guide-to-MediaAsset cover
  relation;
- the existing City Hub and Marketplace migrations required by their workflows.

No existing City Hub JSON is deleted or rewritten by these migrations.

## Environment

The Admin back office introduces no new secrets. It uses the existing Neon,
R2, Upstash, Resend, session, and worker variables documented in
`ENVIRONMENT_VARIABLES.md`. Secrets remain exclusively in provider dashboards
and environment variables and are never readable from `/admin/settings`.
