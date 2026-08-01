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
Admin access. Organization Owner/Admin/Editor/Viewer permissions are checked
inside the protected workspace and APIs. Platform Admins can inspect and
suspend/archive organizations or review verification only when their exact
platform permission allows it. Only a Super Admin can grant or remove official
Kondo partner status.

Only a Super Admin can assign or remove `ADMIN`/`SUPER_ADMIN` roles. An operator
cannot change their own role or status, so the acting administrator cannot
remove the platform's final active administrator through the UI. Role changes
revoke the target's sessions and create an `AuditLog` record.

## Routes

| Route                                   | Purpose                                                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `/admin`                                | Real operational overview, moderation queue, recent users, seven-day engagement, and recent audit activity.      |
| `/admin/users`                          | Search, role/status filters, pagination, account review, suspension/reactivation, sessions, and role assignment. |
| `/admin/communities`                    | User-community moderation plus creation and metadata management for explicitly official communities.             |
| `/admin/marketplace`                    | Listing search, status/fraud review, moderation, seller context, and category management.                        |
| `/admin/reports`                        | Central report queue, assignment, evidence, notes, decisions, and audit history.                                 |
| `/admin/message-safety`                 | Aggregate safety diagnostics only; it does not expose private conversations.                                     |
| `/admin/city-hubs`                      | Multi-city editorial workflow and City Hub creation.                                                             |
| `/admin/city-hubs/:id`                  | Navigation between independently managed City Hub details and existing sections.                                 |
| `/admin/city-hubs/:id/details`          | City identity, introduction, signals, and impact-point form.                                                     |
| `/admin/city-hubs/:id/sections/:slug`   | One existing section with independently persisted settings and entry CRUD.                                       |
| `/admin/city-hubs/:id/preview`          | Protected preview of the current draft before publication.                                                       |
| `/admin/guides`                         | Student Hub guide and ordered-step CMS.                                                                          |
| `/admin/content`                        | Editorial index for Guides, City Hub, official communities, and validated community events.                      |
| `/admin/media`                          | R2-backed media inspection, validation status, retention, and safe removal.                                      |
| `/admin/notifications`                  | Templates, targeted announcement composer, queue result, and worker diagnostics.                                 |
| `/admin/analytics`                      | Real 7/30/90-day database metrics and recorded product-event counts.                                             |
| `/admin/reference-data`                 | Country, city, and university configuration.                                                                     |
| `/admin/organizations`                  | Search/filter organization workspaces by identity, type, lifecycle, verification, capability, country, or city.  |
| `/admin/organizations/:id`              | Organization identity, team, capabilities, lifecycle, partner state, verification history, and scoped audit.     |
| `/admin/organization-verifications`     | Private organization-verification review queue.                                                                  |
| `/admin/organization-verifications/:id` | Least-privilege evidence review, reviewer note, user response, and reviewed status transitions.                  |
| `/admin/housing`                        | Housing supply queue, lifecycle filters, publisher context, inquiry counts, and review/removal actions.          |
| `/admin/housing/:id`                    | Housing listing detail with distinct public/private location facts and non-proof media review.                   |
| `/admin/settings`                       | Safe non-secret configuration index.                                                                             |
| `/admin/audit`                          | Filtered administrative audit history.                                                                           |

Student Hub administration intentionally remains under `/admin/guides`, because
the public Student Hub composes the Guide library, Q&A, and validated community
events. Events are not duplicated into a second model: editorial city events
are City Hub entries, while member/community events use the existing validated
`Post(type=EVENT)` lifecycle.

## Housing operations

Housing is independent from Marketplace. `HOUSING_VIEW` opens the queue;
`HOUSING_LISTINGS_REVIEW` approves or requests changes;
`HOUSING_LISTINGS_REMOVE` removes public supply; `HOUSING_MODERATE` supports
non-final moderation; and `HOUSING_PROOF_VIEW` is required before private proof
documents can be delivered. The permissions are assigned through the existing
role matrix rather than inferred from the presence of the Admin navigation
item.

Housing mutations recheck lifecycle and exact permission on the server, retain
the source record, write AuditLog, notify the publisher through the existing
outbox, and invalidate listing, search, map, organization, city, and sitemap
surfaces. Listing rows never expose proof documents. The central report queue
continues to own reporter identity and case decisions.

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

Organization invitations, role/member changes, ownership transfer,
verification outcomes, and lifecycle decisions use the same notification
outbox and safe internal-link policy. Verification reviewer notes remain
internal; only the explicit user-visible response is sent to organization
operators.

## Organization operations

Organizations never sign in directly. Team members use individual Kondo
accounts and receive one of four workspace roles:

| Workspace role | Main capabilities                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| `OWNER`        | Full workspace control, archive, and two-step ownership transfer.                                              |
| `ADMIN`        | Profile, capabilities, team, verification, analytics, and future publishing; no ownership transfer or archive. |
| `EDITOR`       | Profile and future content editing; no team, verification, or lifecycle controls.                              |
| `VIEWER`       | Dashboard and organization activity only.                                                                      |

Invitations are bound to a normalized email, expire after seven days, and store
only a SHA-256 token hash. Acceptance creates or reactivates one organization
membership transactionally. Suspension blocks organization mutations and
publishing while preserving authorized read access; archive removes the
workspace from normal access without deleting its records or audit trail.

Organization verification and official-partner status are deliberately
separate. An approved verification request sets the organization verification
state only. A Super Admin must make a second, reasoned decision to grant partner
status. Organization verification files are private media and are available
only to the owning organization roles with verification permission and
platform roles with the exact review/media permission.

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
- `20260730150000_organization_professional_workspace_enums`: additive enum
  values committed separately for PostgreSQL compatibility;
- `20260730151000_organization_professional_workspace`: additive profile,
  invitation, transfer, verification, slug-alias, audit, media, lifecycle, and
  partner fields/tables, plus the explicit Manager→Editor and Member→Viewer
  membership-role data migration;
- the existing City Hub and Marketplace migrations required by their workflows.

No user, session, organization, membership, media, community, City Hub JSON, or
legacy verification record is deleted or rewritten by these migrations.

## Environment

The Admin back office introduces no new secrets. It uses the existing Neon,
R2, Upstash, Resend, session, and worker variables documented in
`ENVIRONMENT_VARIABLES.md`. Secrets remain exclusively in provider dashboards
and environment variables and are never readable from `/admin/settings`.

## Public organization profile operations

The existing organization detail page includes a public-profile panel. It
shows publication state, public URL eligibility, readiness, public contact and
gallery counts, trust states, publication timestamps, moderation restriction,
and related `Report` cases. Legal identity and team information remain in
their pre-existing private Admin sections and are never copied into the public
DTO.

Public-profile permissions are independent:

| Permission                               | Purpose                                               |
| ---------------------------------------- | ----------------------------------------------------- |
| `ORGANIZATION_PUBLIC_PROFILES_VIEW`      | Inspect public-profile operational state.             |
| `ORGANIZATION_PUBLIC_PROFILES_MODERATE`  | Request a user-visible profile correction.            |
| `ORGANIZATION_PUBLIC_PROFILES_UNPUBLISH` | Remove a published profile and restrict it.           |
| `ORGANIZATION_PUBLIC_PROFILES_RESTORE`   | Lift a restriction so normal republishing can resume. |

Buttons do not grant permission: the Admin API and domain service recheck the
exact permission. A correction request is preferred when immediate removal is
not necessary. Unpublishing preserves data and historical references, records
an AuditLog entry, notifies active Owner/Admin members through the outbox, and
invalidates the public page, API, directory, Search, sitemap, and related city
rail. Lifting a restriction does not silently verify, partner, activate, or
publish the organization.

Suspension and archive continue through the existing lifecycle controls and
override publication immediately. Verification and official partnership
remain separate decisions.

## Opportunities (Part 5)

Routes:

- `/admin/opportunities` — every opportunity with publisher, lifecycle,
  moderation-block state and an application **count only**. Private application
  content never appears in a list view.
- `POST /api/admin/opportunities/[id]/moderate` — approve, reject, pause,
  remove, restore, or block an unsafe external source.

Permissions:

| Permission                                              | MODERATOR | ADMIN  | SUPER_ADMIN |
| ------------------------------------------------------- | --------- | ------ | ----------- |
| `OPPORTUNITIES_VIEW`                                    | yes       | yes    | yes         |
| `OPPORTUNITIES_REVIEW`                                  | yes       | yes    | yes         |
| `OPPORTUNITY_REPORTS_REVIEW`                            | yes       | yes    | yes         |
| `OPPORTUNITIES_MANAGE`                                  | no        | yes    | yes         |
| `OPPORTUNITIES_REMOVE`                                  | no        | yes    | yes         |
| `SCHOLARSHIP_AGENTS_VIEW` / `SCHOLARSHIP_AGENTS_MANAGE` | no        | yes    | yes         |
| `OPPORTUNITY_PUBLISHERS_RESTRICT`                       | no        | yes    | yes         |
| `OPPORTUNITY_APPLICATIONS_VIEW`                         | no        | **no** | yes         |
| `OPPORTUNITY_APPLICATIONS_SUPPORT`                      | no        | **no** | yes         |

Applicant private data is deliberately outside the ordinary ADMIN role.
`OPPORTUNITY_APPLICATIONS_VIEW` and `OPPORTUNITY_APPLICATIONS_SUPPORT` are held
only by SUPER_ADMIN, are purpose-limited to abuse investigation, technical
support, legal compliance, account recovery and report investigation, and are
never implied by `OPPORTUNITIES_MANAGE`.

Removing an opportunity hides it from every public surface and invalidates the
public page, search, Student Hub and organization projections. It never deletes
submitted applications: applicants keep their history and see a safe
unavailable state.

### Supporting an organization that cannot publish

Publishers now self-diagnose. The organization workspace shows a setup checklist
at `/organizations/[slug]/opportunities` naming the exact missing requirement,
so most "we cannot publish" reports are resolved by the organization itself.
When one reaches support, check in this order — these are independent and none
implies another:

1. **Capability** — `SCHOLARSHIPS` or `INTERNSHIPS_JOBS` must be `ENABLED` on
   the organization. This is the most common cause. The member fixes it under
   the workspace Settings; enabling it grants no publishing right by itself.
2. **Member permission** — `ORGANIZATION_CREATE_OPPORTUNITIES` to author,
   `ORGANIZATION_PUBLISH_OPPORTUNITIES` to publish. EDITOR may author and
   submit but never publish, and holds **no** application access at all: an
   EDITOR reporting that they cannot see applicants is behaving correctly.
3. **Organization lifecycle** — a suspended organization is blocked from
   publishing immediately, including for already-drafted opportunities.
4. **Public profile / verification** — neither is required to create or publish
   an opportunity, and neither should be requested as a workaround.

Drafts are deliberately allowed while the professional profile is still
incomplete, so incomplete setup is never a reason a publisher cannot start work.

Admin never edits an organization's opportunity content to work around a
permission problem; the fix belongs to the organization's own owner or admin.

### ScholarshipAgent operations are unchanged

`/admin/scholarship-agents` and `/admin/scholarships` continue to manage the
legacy tables exactly as before. The public Student Hub no longer shows
Scholarship agents as a separate tab beside scholarships — students see one
unified Scholarships experience — but the records, their admin tooling and
`/student-hub/scholarships/agents` are untouched and still reachable. No legacy
record was migrated, reassigned or converted into an Organization.

### Part 7 Journey and Navigator support

Journey changes are user-confirmed and audited as `KONDO_JOURNEY_UPDATED`.
Administrators do not assign, infer or silently advance a user's stage.
Navigator state is private product preference data and is not exposed as an
admin directory. Support should verify the destination domain has real visible
content and that the user still has route access; it must not inspect messages,
application answers or private documents to explain a recommendation.

## Part 8 sensitive-support permissions

The following permissions are intentionally independent:

| Permission                      | Purpose                                                                         | Default roles      |
| ------------------------------- | ------------------------------------------------------------------------------- | ------------------ |
| `REPORT_VIEW_REPORTER_IDENTITY` | Reveal reporter identity inside one assigned/accessible case; reveal is audited | Admin, Super Admin |
| `HOUSING_PRIVATE_LOCATION_VIEW` | Query exact private address for a Housing moderation detail; access is audited  | Admin, Super Admin |
| `OPPORTUNITY_APPLICATIONS_VIEW` | View bounded applicant metadata, never answers/documents/reviewer notes         | Admin, Super Admin |
| `ORGANIZATION_CATALOG_VIEW`     | Open the professional product/service moderation list                           | Admin, Super Admin |
| `ORGANIZATION_CATALOG_MODERATE` | Remove, restore to review, or block an unsafe catalog URL                       | Admin, Super Admin |

Moderators keep redacted case evidence and never receive these permissions by
entering the Admin shell. Reporter identity is absent from report queues for
every role and appears only on a permitted case detail. Housing list/detail
queries no longer select unused publisher email, and exact location is queried
only after the dedicated permission check.

`/admin/catalog` is the canonical professional product/service moderation
entry. `/admin/opportunity-reports` is a compatibility entry that redirects to
the shared filtered Reports queue so assignment, notes, evidence, reporter
privacy and AuditLog have one implementation.

The full page/API matrix is
[`ROUTE_ACCESS_MATRIX.md`](./ROUTE_ACCESS_MATRIX.md).
