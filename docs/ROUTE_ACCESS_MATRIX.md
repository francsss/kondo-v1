# Final route inventory and access matrix

Last audited: 2026-08-01

Baseline: `b053634900bcc73d91052dc53aee68e009b7177a`

The executable inventory is `npm run release:audit`. It derives every page and
API route directly from `app/`, reports the exact source file and access class,
and fails when an Admin route lacks an explicit permission, an expected entry
route disappears, a compatibility redirect stops redirecting, or a raw PostHog
call bypasses the analytics abstraction. This avoids a copied inventory drifting
away from the source tree.

Current audited inventory:

| Surface          | Count | Policy                                                                                        |
| ---------------- | ----: | --------------------------------------------------------------------------------------------- |
| Pages            |   173 | Public, authenticated, organization-member, or Admin permission                               |
| API routes       |   262 | Public controlled, authenticated, organization permission, Admin permission, or worker secret |
| Admin pages      |    47 | Admin layout plus explicit page permission                                                    |
| Admin API routes |    64 | Explicit `authorizeAdminApi(permission)`                                                      |

Run `npm run release:audit` for the complete JSON inventory or
`npm run release:audit -- --summary` for the policy result.

## Public and authentication routes

| Exact route                                                                   | Purpose                       | Entry                                             | Access                                                                   |
| ----------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| `/`                                                                           | Marketing landing             | Direct/canonical domain                           | Public                                                                   |
| `/about`, `/privacy`, `/terms`, `/guidelines`                                 | Product and legal information | Landing/footer                                    | Public                                                                   |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` | Account lifecycle             | Landing/auth redirects/email links                | Public with server validation                                            |
| `/organizations`                                                              | Public organization directory | Discover, Search, profiles                        | Public                                                                   |
| `/organizations/[slug]`                                                       | Canonical public organization | Directory, Discover, City Hub, Search             | Public only when visibility gates pass; slug aliases redirect            |
| `/housing/listings/[id]`                                                      | Public Housing detail         | Housing, Discover, City Hub, Saved                | Public only through the Housing public visibility rule                   |
| `/opportunities/[slug]`                                                       | Public opportunity detail     | Student Hub, Discover, Search, organization page  | Public/historical visibility rule; applicant data never included         |
| `/products/[slug]`, `/services/[slug]`                                        | Professional catalog detail   | Discover, Essentials, City Hub, organization page | Public only when item, capability, organization, and profile are visible |

## Personal authenticated workspace

| Exact route or family                                                                                      | Entry                                       | Access and context                                                            |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| `/home`                                                                                                    | Primary navigation                          | Signed-in User; private personalized query                                    |
| `/student-hub`                                                                                             | Primary navigation                          | Signed-in User                                                                |
| `/student-hub/scholarships`                                                                                | Student Hub tab                             | Signed-in User; central Opportunity projection plus legacy read-only adapter  |
| `/student-hub/internships`, `/student-hub/jobs`, `/student-hub/programs`                                   | Student Hub tabs                            | Signed-in User; central Opportunity filters                                   |
| `/student-hub/applications`                                                                                | Student Hub tab                             | Signed-in applicant only                                                      |
| `/student-hub/tools`, `/student-hub/tools/timetables/[id]`                                                 | Conditional Tools tab                       | Signed-in User; Journey-gated in UI and ownership-gated on server             |
| `/discover`, `/discover/cities/[slug]`, `/discover/essentials`, `/discover/saved`                          | Primary/context navigation                  | Signed-in User; private recommendation context is never publicly cached       |
| `/communities`, `/communities/[slug]`, `/communities/[slug]/manage`                                        | Primary directory/context actions           | Signed-in User; private community reads require membership                    |
| `/messages`, `/messages/[id]`, `/messages/new`                                                             | Primary/context actions                     | Signed-in participant; conversation membership rechecked per request          |
| `/saved`                                                                                                   | Personal drawer/Home                        | Signed-in User; source visibility rechecked on every read                     |
| `/housing`, `/housing/search`, `/housing/map`, `/housing/saved`, `/housing/requests`, `/housing/roommates` | Personal drawer/Home/Discover               | Signed-in User for personal actions; public listing DTOs remain location-safe |
| `/marketplace`, `/marketplace/[slug]`, `/marketplace/new`, `/marketplace/selling`                          | Primary navigation                          | Signed-in User for mutations; peer-to-peer trust model                        |
| `/opportunities/applications`, `/opportunities/applications/[applicationId]`                               | Student Hub Applications/account navigation | Applicant ownership                                                           |
| `/opportunities/documents`, `/opportunities/profile`, `/opportunities/preferences`, `/opportunities/saved` | Opportunity account navigation              | Signed-in owner only                                                          |
| `/payments`                                                                                                | Essentials/Navigator contextual action      | Signed-in User; provider-unavailable truth state only                         |
| `/notifications`                                                                                           | App shell                                   | Signed-in recipient only                                                      |
| `/profile`, `/profile/[username]`, `/profile/edit`                                                         | App shell/content identity                  | Signed-in User; field audiences enforced server-side                          |
| `/settings/*`                                                                                              | Personal drawer/profile                     | Signed-in User; account/session operations reauthenticate where required      |
| `/stories`, `/stories/submit`, `/stories/report`                                                           | Secondary menu/context rails                | Signed-in User; publication/moderation permissions are server-enforced        |

## Organization workspace

Every route below is nested beneath the server workspace layout. The active
membership is loaded again from the database; removed members lose access on the
next request. Capability controls whether a domain is available, while a member
permission separately controls the action.

| Exact route or family                                                           | Workspace entry          | Required server capability/permission                               |
| ------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------- |
| `/organizations/[slug]/dashboard`                                               | Workspace switcher       | Active membership + dashboard view                                  |
| `/organizations/[slug]/profile`                                                 | Workspace navigation     | Edit profile for mutation                                           |
| `/organizations/[slug]/public-profile`, `/preview`                              | Workspace navigation     | Publication/media permissions                                       |
| `/organizations/[slug]/housing`                                                 | Workspace navigation     | Housing capability + Housing permissions                            |
| `/organizations/[slug]/opportunities`                                           | Workspace navigation     | Opportunity view; setup state remains visible if capability missing |
| `/organizations/[slug]/opportunities/new`                                       | Page hero/workspace list | Opportunity create permission                                       |
| `/organizations/[slug]/opportunities/[opportunityId]/edit`                      | Opportunity list         | Organization ownership + edit permission                            |
| `/organizations/[slug]/opportunities/[opportunityId]/applications`              | Opportunity detail       | Application review permission; never granted to Editor              |
| `/organizations/[slug]/opportunities/applications/[applicationId]`              | Applications list        | Organization scope + review permission                              |
| `/organizations/[slug]/catalog/products`, `/services`                           | Workspace navigation     | Catalog view + matching capability                                  |
| `/organizations/[slug]/catalog/products/new`, `/services/new`                   | Catalog list             | Create permission; capability never grants it                       |
| `/organizations/[slug]/catalog/products/[resourceId]`, `/services/[resourceId]` | Catalog list             | Organization ownership + edit permission                            |
| `/organizations/[slug]/catalog/inquiries`                                       | Workspace navigation     | Inquiry permission; not every member                                |
| `/organizations/[slug]/team`, `/verification`, `/activity`, `/settings`         | Workspace navigation     | Dedicated permission per section                                    |

Organization workspace routes never render the personal mobile bottom bar.
The workspace switcher exposes only active memberships returned by the server.

## Admin routes

Admin navigation is derived from the same global permission matrix used by the
page and API. Important exact entries include:

| Route                                                                              | Explicit permission                                                              |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `/admin`                                                                           | `ADMIN_VIEW_PLATFORM_OVERVIEW` (otherwise Reports redirect)                      |
| `/admin/users`, `/admin/users/[id]`                                                | `USER_VIEW`                                                                      |
| `/admin/organizations`, `/admin/organizations/[id]`                                | `ORGANIZATIONS_VIEW`                                                             |
| `/admin/organization-verifications/*`                                              | `ORGANIZATION_VERIFICATIONS_VIEW`                                                |
| `/admin/housing`, `/admin/housing/[id]`                                            | `HOUSING_VIEW`; exact location needs `HOUSING_PRIVATE_LOCATION_VIEW`             |
| `/admin/opportunities`, `/admin/opportunities/[id]`                                | `OPPORTUNITIES_VIEW`                                                             |
| `/admin/opportunity-applications`                                                  | `OPPORTUNITY_APPLICATIONS_VIEW`                                                  |
| `/admin/opportunity-reports`                                                       | `OPPORTUNITY_REPORTS_REVIEW`, then shared Reports queue                          |
| `/admin/scholarship-agents`                                                        | `SCHOLARSHIP_AGENTS_VIEW`                                                        |
| `/admin/catalog`                                                                   | `ORGANIZATION_CATALOG_VIEW`                                                      |
| `/admin/reports`, `/admin/reports/[id]`                                            | `REPORT_LIST` / `REPORT_VIEW`; reporter identity is separately gated and audited |
| `/admin/media`, `/admin/media/[id]`                                                | `MEDIA_VIEW`                                                                     |
| `/admin/audit`                                                                     | `AUDIT_VIEW_GLOBAL`                                                              |
| `/admin/marketplace`, `/admin/communities`, `/admin/city-hubs/*`                   | Matching domain view permission                                                  |
| `/admin/notifications`, `/admin/message-safety`, `/admin/analytics`, `/admin/live` | Matching support permission                                                      |

The release audit checks all 47 Admin pages and all 64 Admin API routes, not just
the representative table above.

## Compatibility routes

| Legacy route                  | Final behavior                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `/dashboard`                  | Redirects to `/home`                                                             |
| `/explore`                    | Permanent redirect to `/discover`                                                |
| `/student-hub/opportunities`  | Redirects to the central `/opportunities` surface                                |
| `/opportunities/scholarships` | Redirects to `/opportunities?category=scholarships`                              |
| `/opportunities/internships`  | Redirects to `/opportunities?category=internships`                               |
| `/opportunities/jobs`         | Redirects to `/opportunities?category=jobs`                                      |
| `/opportunities/programs`     | Redirects to `/opportunities?category=programs`                                  |
| Old organization slug         | `OrganizationSlugAlias` resolves and permanently redirects to the canonical slug |

Navigation visibility is never authorization. Every mutation and sensitive read
is rejected again on the server.
