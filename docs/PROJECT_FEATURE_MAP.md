# Kondo — functional and technical project map

> Source-of-truth snapshot: repository state including the additive
> `20260730090000_identity_organization_foundation` and
> `2026073015*_organization_professional_workspace*` migrations, audited on
> 2026-07-30.
>
> This document describes what is present in the repository. It distinguishes
> implemented product behavior from provider-dependent behavior, foundations
> reserved for later work, and features that do not exist. It is a code map,
> not a substitute for a production smoke test.

## 1. How another AI should use this document

Before proposing or implementing a change:

1. Find the affected product module below.
2. Read its pages, client components, route handlers, domain service, schemas,
   Prisma models, tests, and external-provider boundary.
3. Inspect the listed downstream dependencies and impact zones.
4. Preserve current authorization, visibility, media, audit, notification, and
   persistence contracts.
5. Extend the current architecture; do not create a parallel implementation.
6. Apply a Prisma migration for every database schema change. Never use
   `prisma db push` against a shared or production database.
7. Run the verification commands in section 16 before calling work complete.

Status vocabulary used throughout:

- **Implemented** — application code, persistence, UI, and tests exist.
- **Provider-dependent** — implemented, but production behavior requires an
  external service and valid environment configuration.
- **Partially implemented** — a real foundation or internal workflow exists,
  but a major user-facing or operational part is intentionally absent.
- **Reserved only** — type, preference, or model exists for forward
  compatibility; it is not a usable product feature.
- **Not implemented** — no production workflow exists and another AI must not
  describe it as available.
- **Runtime validation required** — the code exists, but this audit does not
  certify the currently deployed provider configuration or browser behavior.

## 2. System architecture

Kondo is a modular monolith:

```text
Browser
  → Next.js 16 App Router
    → React 19 Server Components for personalized reads
    → Client Components for interaction-heavy UI
    → Route Handlers for mutations and JSON
      → authentication + same-origin checks + Zod + authorization + rate limit
        → domain services in src/lib
          → Prisma 5
            → PostgreSQL / Neon
          → external provider adapters
```

Primary code locations:

| Location                   | Responsibility                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `app/`                     | Pages, layouts, metadata, route handlers, public/auth/platform/Student Hub/Admin boundaries |
| `src/components/ui/`       | Shared Kondo design-system primitives                                                       |
| `src/components/app/`      | Authenticated shell, global navigation, presence heartbeat                                  |
| `src/components/features/` | Feature-specific UI grouped by domain                                                       |
| `src/features/`            | Typed contracts, Zod schemas, registries, presentation metadata                             |
| `src/lib/`                 | Domain services, queries, authentication, permissions, providers, security, serialization   |
| `prisma/schema.prisma`     | Canonical relational model                                                                  |
| `prisma/migrations/`       | Ordered production database history                                                         |
| `tests/unit/`              | Pure logic, validation, security, rendering-contract tests                                  |
| `tests/integration/`       | Database-backed feature and route tests                                                     |
| `e2e/`                     | Playwright browser journeys against a production build                                      |
| `docs/`                    | Operational and architectural documentation                                                 |
| `scripts/`                 | Production build, workers, setup, seed, and Super Admin bootstrap                           |

Cross-cutting rules:

- Signed-in pages are dynamic and read the current user from an HTTP-only,
  database-backed session.
- The database session re-reads current role and account status; it does not
  trust a stale role embedded in a token.
- Mutating routes validate trusted origin and input, then recheck authorization.
- Admin actions use a permission matrix rather than merely hiding links.
- Material moderation and administrative changes write `AuditLog`.
- Media is private-by-default and served through authorized application routes.
- Server secrets never belong in client components or `NEXT_PUBLIC_` variables.
- User-specific content must pass centralized visibility rules.
- Light/dark mode uses global theme tokens and `next-themes`.
- Framer Motion is used for premium transitions with reduced-motion handling
  where implemented.

Core stack:

- Next.js 16.2, React 19.2, TypeScript, Tailwind CSS.
- Prisma/PostgreSQL with Neon in production.
- Cloudflare R2 through the S3-compatible AWS SDK.
- Resend for transactional email.
- Upstash Redis for production-grade shared rate limiting/cache behavior.
- DeepSeek plus OCR/PDF tooling for timetable extraction.
- Google Maps JavaScript API for Meet discovery maps.
- LiveKit Cloud for audio/video calls.
- Web Push/VAPID for OS-level push.
- PostHog and Vercel Analytics for product analytics.

## 3. Route and shell boundaries

### 3.1 Public and authentication

| Route                      | Purpose                                                                      |
| -------------------------- | ---------------------------------------------------------------------------- |
| `/`                        | Marketing landing page                                                       |
| `/about`                   | Product information                                                          |
| `/privacy`                 | Current MVP privacy boundary                                                 |
| `/terms`                   | Terms                                                                        |
| `/guidelines`              | Community guidelines                                                         |
| `/login`                   | Email/password sign-in                                                       |
| `/register`                | Human account creation with Personal or Organization intent                  |
| `/onboarding`              | Deterministic resolver for the correct resumable onboarding                  |
| `/onboarding/personal`     | Conditional personal journey and context setup                               |
| `/onboarding/organization` | Resumable organization setup wizard                                          |
| `/verify-email`            | Email verification                                                           |
| `/forgot-password`         | Password reset request                                                       |
| `/reset-password`          | Password reset confirmation                                                  |
| `/dashboard`               | Compatibility/redirect route; the primary signed-in landing route is `/home` |

Authentication services are mainly in:

- `src/lib/auth.ts`
- `src/lib/server-auth.ts`
- `src/lib/registration.ts`
- `src/lib/onboarding.ts`
- `src/lib/email.ts`
- `app/api/auth/**`

### 3.2 Main authenticated product

| Route family         | Product area                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `/home`              | Personalized dashboard, live activity, feed, stories, guide/local context                                |
| `/communities/**`    | Communities and Meet                                                                                     |
| `/marketplace/**`    | Marketplace, exchange offers, student skills                                                             |
| `/housing/**`        | Housing discovery, map, listings, requests, roommates, saves and publisher management                    |
| `/explore/[city]/**` | Public City Hub / Explore content                                                                        |
| `/messages/**`       | Conversation list, new conversation, full-screen thread                                                  |
| `/notifications`     | Notification center                                                                                      |
| `/profile/**`        | Own/public profiles and profile editing                                                                  |
| `/search`            | Global search                                                                                            |
| `/guides/**`         | Published guide library compatibility surface                                                            |
| `/help/**`           | Community Q&A compatibility surface                                                                      |
| `/stories/**`        | Student Stories viewer, submission, reporting                                                            |
| `/settings/**`       | Account, privacy, appearance, language, notifications, sessions, official profile, managed organizations |
| `/language`          | Language selector compatibility route                                                                    |
| `/meet/premium`      | Premium feature information and current entitlement status                                               |

The main authenticated shell owns global navigation, unread indicators,
presence heartbeat, theme-aware layout, foreground notification experience, and
Kondo Pet where eligible.

### 3.3 Student Hub

The Student Hub has a separate authenticated shell so the main Kondo navbar is
not duplicated. Its top navigation is declared once in
`src/lib/student-hub-sections.ts` and rendered from that registry:

- Overview — `/student-hub`
- Scholarships — `/student-hub/scholarships`
- Internships — `/student-hub/internships`
- Jobs — `/student-hub/jobs`
- Programs & Research — `/student-hub/programs`
- Applications — `/student-hub/applications`
- Tools — `/student-hub/tools` (journey-gated)

The generic **Opportunities** entry was removed. It opened the same central
Opportunity domain that every other entry already projects, so the hub
presented two competing navigations for one feature. `/student-hub/opportunities`
still resolves for existing links and bookmarks; it is simply no longer a
navigation entry.

Each listing section is a **filtered projection** of the central Opportunity
domain — there is no separate scholarship, internship or job storage:

| Section             | Opportunity types                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| Scholarships        | `SCHOLARSHIP`                                                                                                |
| Internships         | `INTERNSHIP`, `GRADUATE_INTERNSHIP`                                                                          |
| Jobs                | `PART_TIME_JOB`, `FULL_TIME_JOB`, `CAMPUS_JOB`                                                               |
| Programs & Research | `RESEARCH_OPPORTUNITY`, `VOLUNTEERING`, `COMPETITION`, `EXCHANGE_PROGRAM`, `SUMMER_PROGRAM`, `OTHER_PROGRAM` |

A section spans several `OPPORTUNITY_CATEGORIES` (Programs & Research covers
research, programs and volunteering), which is why the hub keeps its own
registry rather than reusing the category list. `unmappedOpportunityTypes()`
fails a unit test if a new type is added without a section, so a publisher can
never create a record no student can browse to.

Selecting a section keeps the student inside the Student Hub: the page title,
metadata, active tab, filters and empty state are all specific to that section.
Internships and the category routes are no longer redirects into a generic
directory.

Additional routes:

- `/student-hub/guide/[slug]`
- `/student-hub/help` and `/student-hub/help/[slug]`
- `/student-hub/scholarships/[slug]`
- `/student-hub/scholarships/agents`
- `/student-hub/tools/timetables/[id]`

Tools remain available to admitted/current students and the retained legacy
incoming-student value. Prospective students, alumni, and professionals keep
every discovery section without an irrelevant timetable-tool entry.

Shell implementation:

- `src/lib/student-hub-sections.ts` — section registry and type mapping
- `src/components/features/student-hub/StudentHubShell.tsx`
- `src/components/features/student-hub/StudentHubOpportunitySection.tsx`
- `app/(student-hub)/student-hub/layout.tsx`

#### Study Essentials

A curated academic catalogue owned by Kondo, not a second marketplace. It
deliberately does not reuse `OrganizationProduct`: that domain models an
organization's own catalogue with contact-based inquiries and its own
moderation lifecycle, whereas Study Essentials is Kondo-curated and, for
Kondo-sourced items, actually sold. `PARTNER` items always send the student to
the partner's own platform and can never be checked out on Kondo.

Payments are simulated. The order carries its provider, status and payment
reference, and is settled in the same transaction only because the payment is
fake — a real provider leaves it `PENDING` until its webhook confirms, which is
the only part an Alipay or WeChat Pay adapter needs to replace.

- `src/lib/study-essentials.ts` — catalogue reads, orderability rule, order placement
- `src/components/features/student-hub/StudyEssentialCover.tsx`
- `src/components/features/student-hub/StudyEssentialCheckout.tsx`
- `app/(student-hub)/student-hub/essentials/**` — catalogue, product, checkout
- `app/(student-hub)/student-hub/orders/**` — order history and confirmation
- `app/api/student-hub/essentials/orders/route.ts`
- `scripts/seed-study-essentials.ts` — idempotent demo catalogue (`npm run essentials:seed`)

Persistence: `StudyEssential`, `StudyEssentialOrder`.

### 3.4 Administrator back office

The Admin shell begins at `/admin`. Exact pages are mapped in section 12.
Access is enforced in `app/admin/layout.tsx`, on every page, and again on every
Admin API mutation.

## 4. Identity, registration, onboarding, and profiles

### 4.1 Account lifecycle — Implemented

Available behavior:

- Email/password registration and login through one human `User` identity.
- Personal and Organization registration intents use the same authentication,
  session, verification, reset, and security system.
- Password hashing with bcrypt.
- Database-backed sessions and secure cookie.
- Email verification request/confirmation.
- Password reset request/confirmation.
- Session listing and individual revocation.
- Account suspension/reactivation by authorized administrators.
- User-request workflows for account-level requests.
- Logout and current-user endpoint.
- Rate limiting and same-origin mutation checks.

Primary pages and APIs:

- `app/register/page.tsx`, `app/login/page.tsx`
- `app/verify-email/page.tsx`
- `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`
- `app/api/auth/**`
- `app/api/settings/sessions/**`
- `app/api/account/requests/**`

Persistence:

- `User`, `Session`, `EmailVerificationToken`, `PasswordResetToken`,
  `AccountRequest`, `AuditLog`.

Change impact:

- Changes to the user identifier, status, role, or session format affect every
  authenticated page, authorization guard, audit entry, notification,
  ownership relation, and LiveKit token.
- Never replace database session checks with client-only role checks.

### 4.2 National community registration — Implemented

Personal registration asks for:

- first and last name;
- email and password;
- gender (`MALE` or `FEMALE`);
- required country of origin selected from all African countries.

`registerUserWithNationalCommunity()` performs a serializable transaction:

1. Upsert the selected African `Country`.
2. Create the user as a normal `MEMBER`.
3. Find the official national community for the country.
4. If absent, create it once with an active/open/official/verified country
   identity.
5. Add every global Admin/Super Admin as owner or moderator.
6. Add the student as a normal community member.
7. Create the database session, audit event, and welcome notification job.

It retries serialization/uniqueness conflicts to prevent duplicate official
communities during simultaneous registrations.

Organization-intent registration creates only the human operator and their
normal database session. It does not create an organization identity, make the
organization a community member, or force personal nationality/gender fields.
If that operator later completes eligible personal onboarding, the same
national-community transaction runs for the human user.

Primary implementation:

- `src/lib/african-countries.ts`
- `src/lib/registration.ts`
- `app/api/auth/register/route.ts`
- `app/register/page.tsx`

Change impact:

- Country changes affect official communities, onboarding reference data,
  profiles, Meet compatibility, search, notification audiences, and analytics.
- Do not make the first student an administrator of the national community.

### 4.3 Onboarding — Implemented

The resumable personal onboarding supports five current journeys plus the
retained legacy `INCOMING_STUDENT` value:

- prospective student — application stage, intended study level/field,
  expected intake, and normalized multiple target cities/universities;
- admitted student — confirmed city/university, program, level, arrival date,
  and optional campus;
- current student — confirmed city/university, program, level, and campus;
- alumnus/alumna — optional former university/program and graduation year;
- professional — current city, professional area, China relationship, and
  professional context without a fake university affiliation.

Long reference lists use searchable selectors. Draft state and the current
step are persisted. Universities are filtered by city, and selecting a new
city clears an incompatible university. Completion updates the same `User`,
normalizes multi-target preferences, preserves existing sessions, audits
journey/affiliation changes, and joins an eligible human to their national
community. It deliberately does **not** create or silently enable a
`MeetDiscoveryProfile`; Meet retains its own explicit discovery setup and
privacy controls.

Primary implementation:

- `app/onboarding/page.tsx`
- `app/onboarding/personal/page.tsx`
- `src/components/onboarding/OnboardingFlow.tsx`
- `src/components/onboarding/OnboardingShell.tsx`
- `src/components/onboarding/fields.tsx`
- `src/lib/onboarding.ts`
- `src/lib/onboarding-requirements.ts`
- `src/lib/personal-journeys.ts`
- `src/lib/reference-data.ts`
- `app/api/onboarding/route.ts`

Persistence:

- `User`, `UserJourneyDetail`, `UserTargetCity`, `UserTargetUniversity`,
  `Country`, `City`, `University`, `AuditLog`.

Change impact:

- Onboarding data personalizes Home, Guides, Student Hub, Meet, search,
  notification matching, university period configuration, and City Hub context.
- A new required onboarding field needs backward compatibility for existing
  accounts and seeded/test accounts.

### 4.4 Profiles and privacy — Implemented

Users can:

- view their own or another visible profile;
- edit supported identity/study/profile fields;
- manage profile audience/privacy preferences;
- report or block another user;
- view official verification state where applicable.

Primary routes:

- `/profile`, `/profile/[username]`, `/profile/edit`
- `/settings/privacy`
- `/api/profile`
- `/api/profiles/[id]`, `/report`, `/api/users/[id]/block`

Profile visibility participates in Home activity, search, community exposure,
Meet discovery, and Stories context. Any profile change must retain centralized
audience filtering.

### 4.5 Professional organization workspaces — Implemented

An organization never authenticates. A real human `User` signs in and may own
or manage several `Organization` records through `OrganizationMembership`.

Implemented:

- independently resumable organization drafts;
- a personal/organization workspace switcher and protected workspace routes;
- organization dashboard, profile, team, verification, activity, and settings;
- organization types, searchable country/optional city, public/legal identity,
  professional contact, general service areas, logo/cover media, and profile
  completeness;
- exactly one active owner enforced by PostgreSQL;
- server-side Owner/Admin/Editor/Viewer permissions, with explicit migration
  from the former Manager/Member vocabulary;
- hashed, expiring, email-bound invitations with resend/cancel/accept/decline;
- immediate role changes, member removal/leave, and two-step ownership
  transfer;
- explicit lifecycle and verification state, both separate from the legacy
  user-level Official Profile verification workflow;
- private organization verification documents, draft/submission/review/
  more-information/resubmission outcomes, and least-privilege Admin review;
- separate Super Admin-controlled official-partner status;
- lifecycle suspension/reactivation/archive controls with reasons,
  notifications, and retained data;
- atomic draft creation with owner membership and audit records;
- completion into `ACTIVE` with `NOT_SUBMITTED` verification;
- capability enable/disable settings and central capability gates;
- multiple organizations per human operator;
- organization-scoped audit history, notification templates, product
  analytics, loading/error/empty states, and paginated Admin lists.

Primary locations:

- `/onboarding/organization`
- `/settings/organizations`
- `/organizations/[slug]/{dashboard,profile,team,verification,activity,settings}`
- `/organization-invitations/**`
- `/admin/organizations/**`
- `/admin/organization-verifications/**`
- `app/api/organizations/**`
- `app/api/organization-invitations/**`
- `app/api/organization-ownership-transfers/**`
- `src/components/onboarding/OrganizationOnboardingFlow.tsx`
- `src/components/organizations/**`
- `src/lib/organization-*.ts`
- `src/lib/organization-authorization.ts`
- `src/lib/organization-capabilities.ts`

Persistence:

- `Organization`, `OrganizationMembership`, `OrganizationCapability`,
  `OrganizationInvitation`, `OrganizationOwnershipTransfer`,
  `OrganizationVerificationRequest`, `OrganizationVerificationDocument`,
  `OrganizationSlugAlias`, `MediaAsset`, `NotificationJob`, `AuditLog`.

Intentionally reserved for the next organization module:

- organization publishing/projection into Marketplace, City Hub, jobs, or
  scholarships;
- public organization directory/profile pages;
- billing or organization analytics.

Those downstream phases must project from these workspaces rather than create
another organization, authentication, verification, media, notification, or
authorization system.

### 4.6 OAuth — Reserved only

`OAuthAccount` exists in Prisma, but there are no OAuth provider routes,
callbacks, sign-in buttons, or account-linking flow. Google/Apple/WeChat login
must not be described as implemented.

## 5. Home and global discovery

### 5.1 Personalized Home — Implemented

`/home` combines:

- a personalized welcome that transitions into Live Activity;
- a chronological activity stream;
- visible posts from joined/accessible communities;
- post creation;
- a people-first Student Stories rail after the opening community posts, with
  vertical media cards, creator/country/university identity, and touch
  discovery;
- personalized guide/local context;
- marketplace/local supporting content;
- presence and product analytics.

The activity stream currently materializes:

- newly onboarded public/non-private members;
- new non-event posts;
- comments;
- community joins;
- community creation;
- published City Hubs;
- active marketplace listings;
- validated upcoming community events.

`FOLLOW_CREATED` and `BADGE_EARNED` exist in the TypeScript activity union as
future-compatible types, but there is no current follow/badge persistence
feeding the stream. They are **reserved only**, not implemented events.

Primary implementation:

- `app/(platform)/home/page.tsx`
- `src/components/features/activity/**`
- `src/lib/home-activity.ts`
- `app/api/activity/route.ts`

Change impact:

- Feed changes must preserve community/post visibility and private profile
  filtering.
- Adding a new activity type requires a real persisted event source, typed
  presentation, link target, privacy rule, tests, and bounded query cost.

### 5.2 Global search — Implemented

Global search covers persisted:

- communities;
- marketplace listings;
- guides;
- questions/help;
- users;
- posts;
- universities;
- countries;
- cities;
- scholarships.

It applies visibility rules and category-specific result serialization.

Primary implementation:

- `/search`
- `app/api/search/route.ts`
- `src/lib/search.ts`
- `src/components/features/search/**`

Change impact:

- A new searchable entity requires visibility policy, query/index strategy,
  result type, category UI, serialization, and tests.
- Never expose private profiles, drafts, private media, or unpublished content
  through a broad search query.

## 6. Communities and Meet

### 6.1 Communities — Implemented

`/communities` has:

- **My Communities**
  - Managed
  - Joined
- **Discover**
  - search
  - recommended, popular, and recent sorting
  - Join, Joined, or Open actions
- **Meet**
  - Random
  - Nearby
  - Looking For

Community capabilities:

- user-created and official communities;
- country, city, university, interest, and general types;
- public/private visibility;
- open, request, or invited membership;
- owner/moderator/member roles;
- member management and ownership transfer;
- invitations and access requests;
- posts, media, comments, reactions, events, reports;
- community requests where members ask for help and others offer assistance;
- management page for authorized owners/moderators;
- official national community auto-membership from registration.

Primary implementation:

- `app/(platform)/communities/**`
- `src/components/features/community/**`
- `src/lib/communities.ts`
- `src/lib/community-requests.ts`
- `app/api/communities/**`
- `app/api/community-requests/**`

Persistence:

- `Community`, `CommunityMember`, `CommunityAccessRequest`,
  `CommunityRequest`, `CommunityRequestHelpOffer`, `Post`, `PostMedia`,
  `Comment`, `Reaction`.

Change impact:

- Membership affects Home feed, notifications, post visibility, events,
  national onboarding, announcement audiences, and Admin moderation.
- Community role is separate from global platform role.
- Ownership transfer is a community administration operation, not a financial
  transfer.

### 6.2 Meet discovery profile — Implemented

Every onboarded user receives a discovery profile. Discovery Settings can
manage:

- gender and interested-in preference;
- age range;
- languages;
- university and city;
- Looking For intentions;
- distance mode/radius;
- Nearby visibility;
- individual profile-field visibility.

Compatibility is evaluated in both directions where required. Exact member
locations are not exposed.

Primary implementation:

- `src/components/features/community/MeetPanel.tsx`
- `src/features/meet/config.ts`
- `src/features/meet/schemas.ts`
- `app/api/meet/profile/route.ts`
- `app/api/meet/discovery/route.ts`

Persistence:

- `MeetDiscoveryProfile` plus discovery fields on `User`.

### 6.3 Random matching — Implemented, provider-dependent

Random Meet:

- places the authenticated user in `MeetQueueEntry`;
- excludes the same account and already occupied users;
- requires compatible country/gender criteria in both directions;
- uses transaction/locking logic to avoid double matches;
- creates one `CallSession` and two `CallParticipant` records;
- periodically retries without concurrent client requests;
- cleans the queue on cancellation/leave and through stale-presence handling;
- displays no-availability state instead of waiting forever.

Primary implementation:

- `app/api/meet/queue/route.ts`
- `src/lib/calls/service.ts`
- `src/components/features/community/MeetPanel.tsx`

Real calls require working LiveKit configuration. Queue/database behavior can
exist while camera/audio still fail if LiveKit or browser permissions are
misconfigured.

### 6.4 Nearby and Looking For map — Implemented, provider-dependent,

runtime validation required

The map implementation now uses a provider abstraction:

- generic contract: `src/lib/maps/provider.ts`;
- configured provider selection: `src/lib/maps/index.ts`;
- Google SDK singleton loader: `src/lib/maps/google-map-loader.ts`;
- Google adapter/controller: `src/lib/maps/google-map-provider.ts`;
- Meet map UI: `src/components/features/community/MeetDiscoveryMap.tsx`;
- privacy positioning/distance helpers: `src/lib/meet-map.ts`.

Current behavior in code:

- creates the base Google map independently of nearby-member loading;
- centers on a known university/city anchor with Jiaxing University as a safe
  startup anchor;
- geocodes public study-area names when required;
- shows a privacy-safe current-user marker, university marker, and nearby member
  markers;
- deterministically perturbs positions around the public study anchor;
- shows friendly approximate distance bands rather than exact distances;
- supports 100 m, 300 m, 500 m, 1 km, 2 km, and 5 km radii;
- filters and sorts visible members by approximate distance;
- uses lightweight pulsing overlay markers and avatar fallback;
- retains map display when geolocation or nearby data is absent;
- reports configuration/authentication/SDK/container errors.

The business layer talks only to `MapProvider`, so AMap can later be introduced
by implementing the same interface and switching the provider factory.

Production dependency:

- optional `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (the UI renders a clear
  privacy-safe unavailable state until configured);
- Maps JavaScript API and Geocoding API enabled;
- Google billing active;
- HTTP referrer restrictions including production and intended previews.

Do not reintroduce Baidu-specific code or WGS84→BD-09 conversion. Baidu files
and configuration are no longer part of the active map path.

Change impact:

- Exact coordinates must never be returned to the browser or shown in marker
  labels.
- Map provider changes should remain within `src/lib/maps/**`; Meet business
  rules should not import Google-specific types.

### 6.5 Premium discovery — Partially implemented

Implemented:

- `SubscriptionPlan` and `UserSubscription`;
- feature-key entitlement checks;
- Admin plan metadata management;
- premium information page;
- gates for full discovery profiles, extended areas, map connections, and
  similar Meet features.

Not implemented:

- real checkout;
- payment collection;
- billing webhook;
- automatic paid subscription activation.

`src/lib/billing/provider.ts` intentionally throws
`BillingNotConfiguredError`. The planned adapter boundary names Alipay, but no
provider is connected. The UI explicitly displays “Checkout unavailable.”

Primary locations:

- `/meet/premium`
- `/admin/settings/premium`
- `src/lib/premium.ts`
- `src/lib/billing/provider.ts`
- `src/components/features/admin/PremiumPlanManager.tsx`

Another AI must not grant premium access from an unverified client callback.
Only a cryptographically verified provider event may activate a paid
subscription.

## 7. Messaging and calls

### 7.1 Private messaging — Implemented

Capabilities:

- create/direct conversations;
- list conversations;
- full-screen conversation route;
- send text and supported media messages;
- read state;
- archive/delete conversation participation;
- block and report;
- aggregate message-safety Admin diagnostics without exposing arbitrary private
  conversation content;
- start private audio or video calls.

Primary implementation:

- `app/(platform)/messages/**`
- `src/components/features/messages/**`
- `src/lib/messaging.ts`
- `app/api/messages/route.ts`
- `app/api/conversations/**`

Persistence:

- `Conversation`, `ConversationParticipant`, `Message`, `UserBlock`, `Report`.

Important limitation:

- Messages are persisted through HTTP routes and Server Component refreshes.
  There is no dedicated WebSocket message transport in the repository. Do not
  describe chat synchronization as socket-real-time without adding and testing
  such infrastructure.

### 7.2 Audio/video calls — Implemented, provider-dependent

Meet and private conversation calls share the call layer:

- server-side LiveKit room preparation;
- short-lived, room-scoped participant tokens;
- maximum two participants;
- audio/video kind;
- participant presence;
- mute/camera controls through official LiveKit React/client SDKs;
- leave/cleanup, status, block, and report flows.

Primary implementation:

- `src/lib/calls/provider.ts`
- `src/lib/calls/service.ts`
- `src/components/features/calls/**`
- `app/api/calls/[id]/**`
- `app/api/conversations/[id]/calls/route.ts`

Production dependency:

- `LIVEKIT_URL` (`wss://...`);
- `LIVEKIT_API_KEY`;
- `LIVEKIT_API_SECRET`.

Only server code may read the API key/secret. Browser permission denial,
expired tokens, and unavailable LiveKit configuration must remain explicit
errors.

## 8. Marketplace

### 8.1 Classified marketplace — Implemented

Capabilities:

- persisted listing creation/editing;
- category and city selection;
- image upload;
- listing detail;
- search, price/category/city filters, sorting;
- favorite/unfavorite;
- seller “selling” area;
- draft/active/reserved/sold/removed/expired lifecycle;
- expiry worker;
- seller contact through messaging;
- reporting and fraud-signal scoring;
- Admin listing/category moderation.

Primary implementation:

- `app/(platform)/marketplace/**`
- `src/components/features/marketplace/**`
- `src/lib/marketplace.ts`
- `app/api/marketplace/**`

Persistence:

- `MarketplaceCategory`, `MarketplaceListing`, `ListingImage`,
  `ListingFavorite`, `Report`.

### 8.2 Community Exchange — Implemented as introductions only

Users can post exchange offers with searchable currencies, amounts, note, and
city; browse offers; contact the owner; and close/expire an offer.

Kondo does **not** hold, send, settle, convert, or guarantee money. The module
is a peer-introduction surface with explicit safety language.

Persistence:

- `CommunityExchangeOffer`.

### 8.3 Student Skills — Implemented

Users can publish and browse skill offers with title, category, description,
availability, and city, then contact each other through messaging.

Persistence:

- `StudentSkillOffer`.

### 8.4 Financial transactions — Not implemented

There is no:

- Kondo wallet;
- card/mobile-money/bank payment;
- remittance;
- FX conversion;
- escrow;
- settlement;
- KYC/AML workflow;
- transaction ledger;
- marketplace checkout.

Notification preferences contain a future “Payments and transfers” category,
but this is **reserved only**. The privacy page explicitly states that the MVP
does not collect wallet/payment/transfer/settlement/KYC data.

Any future Africa→China money-transfer product is a separate regulated project
that will affect identity verification, compliance, ledgering, provider
webhooks, reconciliation, refunds, disputes, security, privacy, and financial
reporting.

## 9. Explore and City Hub

### 9.1 Public Explore — Implemented

Public routes:

- `/explore/[city]`
- `/explore/[city]/[section]`

The typed City Hub contract contains these current sections:

- companies;
- products;
- universities;
- jobs;
- events;
- services;
- about.

Supported entry types:

- `company`;
- `product`;
- `university`;
- `opportunity`;
- `event`;
- `service`;
- `story`.

Primary contracts:

- `src/features/explore/types.ts`
- `src/features/explore/registry.ts`
- `src/components/features/explore/**`
- `src/lib/city-hub.ts`

### 9.2 City Hub editorial workflow — Implemented

`CityHub` stores:

- an editable validated `draft` JSON snapshot;
- an immutable public `published` JSON snapshot;
- optimistic `version`;
- DRAFT/REVIEW/PUBLISHED lifecycle.

Every existing section has an independent Admin area and independent item
create/edit/delete persistence. Saving one company does not require an
internship/opportunity or another section. Publication validates the complete
public contract. Revise keeps the last public snapshot; unpublish removes it.

Admin routes:

- `/admin/city-hubs`
- `/admin/city-hubs/[id]`
- `/admin/city-hubs/[id]/details`
- `/admin/city-hubs/[id]/sections/[sectionSlug]`
- `/admin/city-hubs/[id]/preview`

Change impact:

- Adding an entry type requires updating the TypeScript contract, Zod schema,
  Admin editor defaults/guidance, public renderer, and tests.
- Managed unpublished cities must not accidentally expose draft content.
- Student Hub internships/opportunities derive from published City Hub job
  entries, so City Hub schema/content changes affect those pages.

## 10. Student Hub

### 10.1 Guides — Implemented

Capabilities:

- published guides with ordered steps;
- search/category filtering;
- personalized guide relevance from student journey;
- saved/progress/checklist behavior;
- Admin guide and step CMS;
- optional secure cover media.

Persistence:

- `Guide`, `GuideStep`, `GuideProgress`.

Primary locations:

- `/student-hub`
- `/student-hub/guide/[slug]`
- `/admin/guides`
- `src/components/features/guides/**`
- `app/api/guides/progress/[stepId]/route.ts`

### 10.2 Help/Q&A — Implemented

Capabilities:

- questions and answers;
- categories;
- recent/popular/unanswered/personal views;
- answer votes;
- community-compatible help routes.

Persistence:

- `Question`, `Answer`, `AnswerVote`.

Primary locations:

- `/student-hub/help`, `/student-hub/help/[slug]`
- `/help`, `/help/[slug]`
- `app/api/questions/**`, `app/api/answers/**`

### 10.3 Scholarships — Implemented

Capabilities:

- database-backed scholarship catalog;
- search and filters for country, university, level, field, funding, and
  status;
- featured/verified presentation;
- details and official source;
- save/favorite;
- user application status tracking;
- scholarship agent directory;
- agent reporting;
- Admin scholarship and agent CRUD.

Persistence:

- `Scholarship`, `ScholarshipUniversity`, `ScholarshipFavorite`,
  `ScholarshipAgent`.

Primary locations:

- `/student-hub/scholarships/**`
- `/admin/scholarships`
- `src/lib/scholarships.ts`
- `src/features/scholarships/schemas.ts`
- `app/api/student-hub/scholarships/**`
- `app/api/admin/scholarships/**`
- `app/api/admin/scholarship-agents/**`

Kondo displays information and tracking; it does not submit an external
university application on the student's behalf.

### 10.4 Internships and Opportunities — Implemented as City Hub views

These pages read published City Hub `jobs` sections and select
`opportunity` entries. They do not have a separate internship database model.

Primary locations:

- `/student-hub/internships`
- `/student-hub/opportunities`
- `src/lib/student-opportunities.ts`

Change impact:

- Content creation happens through City Hub Admin.
- Changing City Hub section slugs or entry types can make these pages empty.
- A future application-tracking workflow would require a new model; it should
  not overload the City Hub editorial JSON.

### 10.5 Academic OS / My Tools — Implemented, DeepSeek provider-dependent

Student capabilities:

- Today, Schedule, and Tasks areas;
- week, month, and semester schedule views;
- persistent schedules and courses;
- manual course creation/edit/delete;
- conflict warnings;
- academic tasks for assignments, projects, exams, reminders, and events;
- task status and priority;
- timetable import from one to five PDF/JPG/PNG/WebP files;
- explicit review/edit/add/duplicate/delete before confirmation;
- source retention choice;
- refresh-safe saved result.

Timetable import pipeline:

1. Upload source privately with media purpose `SCHEDULE_IMPORT`.
2. Validate ownership, type/signature, size, university/campus/term relation.
3. Native PDF: layout-aware embedded text extraction.
4. Weak/scanned PDF: render pages to images and OCR.
5. Image: orientation correction, resize, contrast normalization, OCR, and
   second high-contrast pass when useful.
6. Send extracted text—not raw image bytes—to DeepSeek Chat Completions.
7. Validate structured JSON against `scheduleExtractionSchema`.
8. Apply official or custom numbered-period mappings.
9. Store a `REVIEW_REQUIRED` import result.
10. Let the student correct it.
11. On explicit confirmation, atomically create the schedule/courses/tasks and
    snapshot period configuration.
12. Remove source files unless retention was requested.

AI provider:

- `DEEPSEEK_API_KEY` is server-only;
- default provider is `deepseek`;
- reviewed default model is `deepseek-v4-flash`;
- optional timeout is clamped;
- rate limit is five analyses per student per 24 hours;
- one transient provider retry is supported.

Primary implementation:

- `/student-hub/tools`
- `/student-hub/tools/timetables/[id]`
- `src/components/features/student-hub/**`
- `src/features/student-hub/schemas.ts`
- `src/lib/schedule-ai.ts`
- `src/lib/schedule-import.ts`
- `src/lib/schedule-extraction-normalization.ts`
- `src/lib/schedule-validation.ts`
- `src/lib/student-schedule.ts`
- `src/lib/student-academic-tools.ts`
- `app/api/student-hub/imports/**`
- `app/api/student-hub/schedules/**`
- `app/api/student-hub/tasks/**`

Persistence:

- `StudentSchedule`, `ScheduleCourse`, `AcademicTask`, `ScheduleImport`,
  `ScheduleImportFile`, `ScheduleImportResult`.

### 10.6 University period configuration — Implemented

Administrators can configure:

- campus;
- academic term;
- university-wide or campus-specific period configuration;
- individually numbered periods with start time and duration/end time;
- active/default configuration and versioning;
- manual creation;
- AI extraction of period structure from an official image/PDF;
- review/edit/add/delete/reorder before save;
- overlap, duplicate, time, and duration validation.

Students can also store a private custom period mapping. Confirmed schedules
retain a snapshot so later Admin changes do not rewrite historical schedules.

Primary locations:

- `/admin/student-hub`
- `app/api/admin/student-hub/**`
- `app/api/student-hub/custom-period-configurations/route.ts`
- `src/lib/university-periods.ts`
- `src/lib/period-configuration-ai.ts`

Persistence:

- `Campus`, `AcademicTerm`, `UniversityPeriodConfiguration`, `ClassPeriod`,
  `CustomPeriodConfiguration`.

## 11. Student Stories and official identities

### 11.1 Student Stories — Implemented

Capabilities:

- immersive vertical story viewer;
- visible per-Story playback progress and mobile tap navigation;
- autoplay/data-saver preference;
- mute/pause and keyboard/touch navigation;
- MP4, MOV, M4V, HEVC/H.265 and allowed mobile video handling under current
  media policies;
- poster image;
- caption/language/category metadata;
- contextual links to city, university, community, company, internship, event;
- local draft during submission;
- like, save, hide, share, comments, captions, and report;
- moderation and revision lifecycle;
- scheduled publishing worker;
- Admin categories, creator approvals, moderation, and transitions;
- contextual recommendations and analytics.
- a local-only, explicitly enabled ten-Story demo dataset for UI validation;
  it is never part of the normal or production seed path.

Primary locations:

- `/stories`, `/stories/submit`, `/stories/report`
- `/admin/stories`
- `src/components/features/stories/**`
- `src/lib/stories.ts`
- `app/api/stories/**`
- `app/api/admin/stories/**`

Persistence:

- `StoryCategory`, `Story`, `StoryEntityLink`, `StoryComment`, `StoryLike`,
  `StorySave`, `StoryHide`, `StoryModerationEvent`.

Actual device playback still depends on browser codec support. Accepting a HEVC
container does not guarantee every browser can decode it; transcoding is not a
separate media service in this repository.

### 11.2 Official verification badge — Implemented

This existing workflow verifies a trusted identity attached to a human `User`;
it is not the new `Organization` verification lifecycle. Supported official
profile types include Kondo/trusted institutions such as universities, student
associations, embassies, organizations, and other approved entities defined by
`OfficialOrganizationType`.

Workflow:

- user submits organization identity, authority description, website, and
  private verification documents;
- media ownership/security is validated;
- Admin reviews, requests more information, approves, rejects, or schedules
  review;
- decision and status are audited;
- approved identity is exposed through a reusable `OfficialMark`.

Badge presentation is reused across supported identity surfaces including
profiles, communities/posts/comments/search/Stories where those components
render the official DTO.

Primary locations:

- `/settings/official-profile`
- `/admin/official-profiles`
- `src/components/features/official-profile/**`
- `src/lib/official-profiles.ts`
- `app/api/official-profile/route.ts`
- `app/api/admin/official-profiles/[id]/route.ts`

Persistence:

- official fields on `User`;
- `OfficialVerificationRequest`;
- `OfficialVerificationDocument`.

## 12. Notifications, presence, feedback, and analytics

### 12.1 Notification center/outbox — Implemented

Capabilities:

- persisted notification center;
- unread count;
- mark one/all read;
- hide/remove from the user's center;
- safe internal links;
- category-specific preferences;
- deduplicated `NotificationJob` outbox;
- editable Admin templates with token validation;
- targeted announcements for all, city, university, or community;
- email digests;
- foreground banners;
- optional sound/haptics;
- optional OS Web Push;
- worker diagnostics.

Current template keys cover:

- new message;
- post comment;
- Q&A reply;
- marketplace contact;
- moderation result;
- Admin announcement;
- community request help/closed;
- welcome and onboarding reminder;
- community post/daily/member summaries;
- Meet matches;
- academic class reminder/import ready;
- scholarship match;
- nearby marketplace recommendation.

Primary locations:

- `/notifications`
- `/settings/notifications`
- `/admin/notifications`
- `src/lib/notifications.ts`
- `src/lib/smart-notifications.ts`
- `src/lib/push-notifications.ts`
- `src/components/features/notifications/**`
- `app/api/notifications/**`
- `app/api/internal/notifications/**`

Persistence:

- `Notification`, `PushSubscription`, `NotificationTemplate`,
  `NotificationAnnouncement`, `NotificationJob`, notification fields in
  `UserPreference`.

Delivery boundaries:

- In-app persistence is database-backed.
- Foreground banners are received through service-worker messages or visible
  page polling (currently a 20-second loop).
- OS push requires all VAPID variables, browser permission, a valid stored
  subscription, and provider delivery.
- Email requires Resend configuration and recipient preferences.

Production status note:

- The code path exists, but browser/OS push and foreground-banner behavior must
  be treated as **runtime validation required**. A notification appearing in
  the center proves persistence, not VAPID delivery or immediate banner
  delivery.

### 12.2 Presence — Implemented

Authenticated shells send heartbeat updates. Presence supports:

- Admin live-user view;
- last-active context;
- Meet availability and stale-user cleanup;
- online/recent activity decisions.

Primary locations:

- `src/components/app/PresenceHeartbeat.tsx`
- `app/api/presence/heartbeat/route.ts`
- `app/api/admin/presence/route.ts`
- `/admin/live`
- `UserPresence`.

Presence is heartbeat-based, not a general-purpose realtime event bus.

### 12.3 Kondo Pet — Implemented as a feedback assistant

Kondo Pet is not a chatbot. It is a temporary feedback surface mounted in the
main and Student Hub shells.

Behavior:

- eligible on Home, Communities, Explore, Marketplace, and Student Hub;
- appears after seven seconds without activity;
- remains visible for nine seconds;
- appears once per product area per browser session;
- successful submission snoozes it for seven days;
- respects reduced motion;
- can be disabled with `NEXT_PUBLIC_KONDO_PET_ENABLED=false`.

Admin can search/filter feedback, inspect a case, add internal notes, transition
status, export, and view summary counts. Changes are audited.

Primary locations:

- `docs/kondo-pet.md`
- `src/components/features/feedback/**`
- `src/lib/kondo-pet.ts`
- `src/lib/pet-feedback.ts`
- `app/api/feedback/route.ts`
- `app/api/admin/feedback/**`
- `/admin/feedback`

Persistence:

- `PetFeedback`, `PetFeedbackNote`.

### 12.4 Analytics — Implemented, provider-dependent

Kondo stores a constrained internal `AnalyticsEvent` stream and integrates:

- PostHog browser/server analytics when configured;
- Vercel Analytics;
- Admin database metrics for 7/30/90-day periods;
- product event dashboards/setup script;
- Stories and Kondo Pet interaction events.

Primary locations:

- `/admin/analytics`
- `src/lib/analytics.ts`
- `src/lib/product-analytics-*.ts`
- `scripts/setup-posthog-dashboards.mjs`
- `AnalyticsEvent`.

Analytics must not contain message bodies, timetable source text, private
verification documents, secrets, or precise Meet coordinates.

## 13. Media and storage

### 13.1 Secure media pipeline — Implemented, provider-dependent

Supported product media uses a two-phase workflow:

1. Browser requests an upload intent.
2. Server validates purpose/kind/limits and returns local upload or signed R2
   authorization.
3. Browser uploads bytes.
4. Browser calls completion.
5. Server reads the object, checks MIME signature/size/dimensions or PDF
   structure, scan state, and ownership.
6. `MediaAsset` becomes active and is attached to the domain entity.
7. Delivery goes through `/api/media/[id]` with visibility authorization.

Production uses a private Cloudflare R2 bucket through the S3-compatible API.
Local development can use the private local driver. Production rejects the
local driver.

Used by profiles, communities, posts, marketplace, messages, guides, stories,
verification documents, timetable import, and other declared `MediaPurpose`
values.

Primary locations:

- `src/lib/media.ts`
- `src/lib/storage.ts`
- `src/lib/media-policy.ts`
- `app/api/media/**`
- `/admin/media`

Persistence:

- `MediaAsset` and feature attachment relations.

Change impact:

- New upload purposes require policy, MIME/signature/size rules, ownership,
  attachment lifecycle, delivery visibility, cleanup behavior, tests, and R2
  compatibility.
- Never store durable uploads in Vercel's ephemeral filesystem.

## 14. Administrator back office

### 14.1 Role matrix

| Role          | Effective Admin scope                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `MEMBER`      | No Admin access                                                                                       |
| `MODERATOR`   | Assigned/redacted report operations plus Story moderation permissions currently granted by the matrix |
| `ADMIN`       | Most operational, CMS, user, media, notification, analytics, and settings permissions                 |
| `SUPER_ADMIN` | Every Admin permission, full audit/security metadata, global role assignment                          |

Only Super Admin can assign/remove Admin or Super Admin roles. Operators cannot
change their own role/status or remove the final active administration path.
Role/status changes revoke relevant sessions and are audited.

Canonical matrix:

- `src/lib/authorization.ts`
- `src/lib/server-auth.ts`
- `docs/ADMIN.md`

### 14.2 Admin route inventory

| Route                                           | Function                                                   |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `/admin`                                        | Operational overview                                       |
| `/admin/users`, `/admin/users/[id]`             | User search, status, role, sessions, account review        |
| `/admin/communities`, `/admin/communities/[id]` | Community moderation and official community management     |
| `/admin/marketplace`, `/admin/marketplace/[id]` | Listing and category moderation                            |
| `/admin/reports`, `/admin/reports/[id]`         | Assignment, evidence, notes, decisions, history            |
| `/admin/message-safety`                         | Aggregate message safety diagnostics                       |
| `/admin/city-hubs/**`                           | City Hub details, independent sections, preview, lifecycle |
| `/admin/guides/**`                              | Guide/step CMS                                             |
| `/admin/content`                                | Editorial index                                            |
| `/admin/media/**`                               | Media inspection/status/removal                            |
| `/admin/notifications`                          | Templates, announcements, queue diagnostics                |
| `/admin/reference-data`                         | Countries, cities, universities                            |
| `/admin/student-hub`                            | Campuses, academic terms, period configuration             |
| `/admin/scholarships`                           | Scholarships and agents                                    |
| `/admin/stories`                                | Story/categories/creator moderation                        |
| `/admin/official-profiles`                      | Official verification review                               |
| `/admin/organizations/**`                       | Organization operations, lifecycle, partner status         |
| `/admin/organization-verifications/**`          | Private organization verification review                   |
| `/admin/feedback/**`                            | Kondo Pet feedback queue                                   |
| `/admin/live`                                   | Presence/live users                                        |
| `/admin/analytics`                              | Product/database metrics                                   |
| `/admin/audit`                                  | Global audit history                                       |
| `/admin/settings`                               | Safe non-secret settings index                             |
| `/admin/settings/premium`                       | Plan metadata and feature keys; no checkout                |

The first Super Admin is created once with:

```bash
npm run admin:bootstrap -- verified-admin@example.com --confirm
```

The script refuses if an active Super Admin already exists. Later role changes
must use the reviewed Admin process.

## 15. Data model, API groups, providers, and workers

### 15.1 Prisma model groups

Identity/reference:

- `User`, `Country`, `City`, `University`, `UserPreference`, `Session`,
  `EmailVerificationToken`, `PasswordResetToken`, `OAuthAccount`,
  `AccountRequest`, `UserJourneyDetail`, `UserTargetCity`,
  `UserTargetUniversity`.

Organizations:

- `Organization`, `OrganizationMembership`, `OrganizationCapability`,
  `OrganizationInvitation`, `OrganizationOwnershipTransfer`,
  `OrganizationVerificationRequest`, `OrganizationVerificationDocument`,
  `OrganizationSlugAlias`.

Academic:

- `Campus`, `AcademicTerm`, `UniversityPeriodConfiguration`, `ClassPeriod`,
  `CustomPeriodConfiguration`, `StudentSchedule`, `ScheduleCourse`,
  `AcademicTask`, `ScheduleImport`, `ScheduleImportFile`,
  `ScheduleImportResult`.

Scholarships:

- `Scholarship`, `ScholarshipUniversity`, `ScholarshipFavorite`,
  `ScholarshipAgent`.

Communities/content:

- `Community`, `CommunityMember`, `CommunityAccessRequest`,
  `CommunityRequest`, `CommunityRequestHelpOffer`, `Post`, `PostMedia`,
  `Comment`, `Reaction`, `Guide`, `GuideStep`, `GuideProgress`, `CityHub`,
  `Question`, `Answer`, `AnswerVote`, `Bookmark`.

Marketplace:

- `MarketplaceCategory`, `MarketplaceListing`, `ListingImage`,
  `ListingFavorite`, `CommunityExchangeOffer`, `StudentSkillOffer`.

Stories/official:

- `StoryCategory`, `Story`, `StoryEntityLink`, `StoryComment`, `StoryLike`,
  `StorySave`, `StoryHide`, `StoryModerationEvent`,
  `OfficialVerificationRequest`, `OfficialVerificationDocument`.

Messaging/Meet/calls:

- `Conversation`, `ConversationParticipant`, `Message`, `MeetQueueEntry`,
  `MeetDiscoveryProfile`, `CallSession`, `CallParticipant`, `UserBlock`.

Premium:

- `SubscriptionPlan`, `UserSubscription`.

Trust/operations:

- `Report`, `ReportNote`, `ReportEvidence`, `AuditLog`, `MediaAsset`,
  `AnalyticsEvent`, `UserPresence`, `PetFeedback`, `PetFeedbackNote`.

Notifications:

- `Notification`, `PushSubscription`, `NotificationTemplate`,
  `NotificationAnnouncement`, `NotificationJob`.

### 15.2 API groups

| Prefix                                              | Responsibility                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `/api/auth/**`                                      | Registration, login/logout, current account, verification, password reset           |
| `/api/onboarding`                                   | Draft/complete onboarding                                                           |
| `/api/organizations`, `/api/organizations/**`       | Organization setup, profile, capabilities, team, ownership, verification, lifecycle |
| `/api/organization-invitations/**`                  | Email-bound invitation decisions                                                    |
| `/api/organization-ownership-transfers/**`          | Two-step ownership transfer decisions                                               |
| `/api/profile`, `/api/profiles/**`                  | Profile read/update/report                                                          |
| `/api/settings/**`, `/api/account/**`               | Preferences, sessions, account requests                                             |
| `/api/communities/**`, `/api/community-requests/**` | Community, membership, content, help requests                                       |
| `/api/posts/**`, `/api/comments/**`                 | Posts, reactions, comments, reports, moderation                                     |
| `/api/marketplace/**`                               | Listings, favorites, lifecycle, exchange, skills                                    |
| `/api/messages`, `/api/conversations/**`            | Messaging, conversation safety, private calls                                       |
| `/api/meet/**`, `/api/calls/**`                     | Discovery, queue, call presence/token                                               |
| `/api/student-hub/**`                               | Imports, schedules, courses, tasks, custom periods, scholarships                    |
| `/api/stories/**`                                   | Feed/submission/revision/interactions/comments/captions/reports                     |
| `/api/media/**`                                     | Upload, completion, delivery                                                        |
| `/api/notifications/**`                             | Center, unread/read, push subscription                                              |
| `/api/search`, `/api/activity`, `/api/presence/**`  | Cross-product discovery/activity/presence                                           |
| `/api/questions/**`, `/api/answers/**`              | Q&A                                                                                 |
| `/api/official-profile`                             | Own verification request                                                            |
| `/api/feedback`                                     | Kondo Pet submission                                                                |
| `/api/admin/**`                                     | Permission-protected administration                                                 |
| `/api/internal/**`                                  | Secret-protected scheduled workers                                                  |

### 15.3 Production providers and environment variables

| Provider          | Variables                                                                                                                              | Scope                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Neon PostgreSQL   | `DATABASE_URL`, `DIRECT_URL`                                                                                                           | Server only                                    |
| Session signing   | `JWT_SECRET`                                                                                                                           | Server only                                    |
| Canonical app URL | `NEXT_PUBLIC_APP_URL`                                                                                                                  | Public canonical origin                        |
| Cloudflare R2     | `STORAGE_DRIVER=s3`, `STORAGE_BUCKET`, `STORAGE_REGION=auto`, `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` | Server except driver metadata                  |
| Resend            | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`                                                                                | Server only                                    |
| Upstash           | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                                                                   | Server only                                    |
| Scheduled jobs    | `CRON_SECRET` plus optional route-specific worker secrets                                                                              | Server/GitHub secret                           |
| DeepSeek          | `DEEPSEEK_API_KEY`, optional `SCHEDULE_AI_PROVIDER`, `SCHEDULE_AI_MODEL`, `SCHEDULE_AI_TIMEOUT_MS`                                     | Server only                                    |
| Google Maps       | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`                                                                                                      | Public restricted browser key                  |
| LiveKit           | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`                                                                                 | URL returned as needed; key/secret server only |
| Web Push          | `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`                                              | Public key public; private key server only     |
| PostHog           | `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`; setup-only management variables                                       | Mixed as documented                            |
| Kondo Pet         | `NEXT_PUBLIC_KONDO_PET_ENABLED`                                                                                                        | Public feature flag                            |

Canonical details and formats are in:

- `docs/ENVIRONMENT_VARIABLES.md`
- `.env.example`
- `src/lib/environment.ts`
- `docs/PRODUCTION_READINESS.md`

Never paste real secrets into prompts, issues, logs, screenshots, commits, or
this document. Rotate any credential that has been exposed.

### 15.4 Scheduled workers

Current worker capabilities:

- process notification outbox;
- send notification email digests;
- create smart notification jobs;
- expire marketplace listings;
- clean orphan/expired media;
- expire community requests;
- publish scheduled Stories.

Entrypoints:

- `app/api/internal/notifications/process/route.ts`
- `app/api/internal/notifications/digest/route.ts`
- `app/api/internal/marketplace/expire/route.ts`
- `app/api/internal/media/cleanup/route.ts`
- `app/api/internal/community-requests/expire/route.ts`
- `app/api/internal/stories/publish/route.ts`
- `.github/workflows/scheduled-workers.yml`
- matching scripts in `scripts/`.

GitHub Actions calls the production application with `CRON_SECRET`. There is no
Cloudflare Worker implementation in this repository.

## 16. Change-impact matrix

| If changing…                           | Inspect and retest…                                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`, registration, onboarding       | Auth/session serializers, national community transaction, profiles, Home personalization, Meet, search, Student Hub, notifications, Admin users                     |
| `Organization` workspace               | Human membership, role matrix, capabilities, invitations, ownership, lifecycle, verification/partner separation, private evidence, brand media, audit, Admin routes |
| Country/city/university reference data | Onboarding filters, profiles, national communities, Meet anchors/discovery, Google geocoding, City Hub, scholarships, notification audiences, university periods    |
| Roles/permissions                      | Server layouts, Admin pages, every Admin route, community roles, audit, session revocation, tests                                                                   |
| Community membership/visibility        | Home feed/activity, community detail, post/search visibility, invitations/access, announcements, national onboarding                                                |
| Posts/comments/reactions               | Home feed/activity, notifications, reports, events, community counts, search                                                                                        |
| City Hub schema                        | Admin independent editors, publication validation, Explore public rendering, Student Hub internships/opportunities, static registry fallback                        |
| Marketplace listing lifecycle          | Public queries, seller pages, favorites, expiration worker, notifications, moderation, search                                                                       |
| Media policy/storage                   | Every uploader, R2/local adapters, upload completion, delivery authorization, cleanup, Admin media, Stories/timetables                                              |
| Timetable extraction schema            | OCR/parser, DeepSeek prompt/JSON, review UI, validation diagnostics, period conversion, confirmation transaction, academic reminders                                |
| University periods                     | Admin configuration, AI extraction, custom mappings, schedule snapshots, imported/manual course times                                                               |
| Meet profile/compatibility             | Onboarding defaults, discovery settings, Nearby/Looking For queries, Random queue, smart notifications, privacy                                                     |
| Map provider                           | Only generic map contract/adapter/factory where possible; then markers, radius, privacy positions, provider env, browser tests                                      |
| LiveKit calls                          | Queue/call session lifecycle, conversation calls, token scope/expiry, presence, cleanup, browser permissions                                                        |
| Notification template/type             | Presentation category, preference gate, tokens, producer, outbox worker, banner, push/email, Admin template UI                                                      |
| Stories                                | Media codecs/policies, moderation, official identities, interactions, scheduled worker, contextual recommendations                                                  |
| Official verification                  | Private document media, Admin permissions, status machine, badge DTOs on every identity surface, audit/notifications                                                |
| Premium entitlement                    | Plan feature keys, Meet gates, Admin plans; never activate from unverified client/payment state                                                                     |
| Theme/navigation                       | Main shell, Student Hub shell, Admin subnavigation, mobile safe areas, foreground banner z-index, full-screen messages/calls                                        |
| Search                                 | Visibility policy, indexes/query limits, result DTO/category UI, empty states, tests                                                                                |

## 17. Known boundaries and claims another AI must not make

The following are not currently complete product capabilities:

1. **Money transfer/payment/wallet** — not implemented.
2. **Marketplace checkout/escrow** — not implemented.
3. **Premium checkout** — not implemented; only plans/entitlements/gates exist.
4. **OAuth/social login** — not implemented; database model only.
5. **Follow graph** — no current persisted follow feature; activity type is
   reserved only.
6. **Achievement/badge engine** — official verification exists, but the generic
   `BADGE_EARNED` activity type is reserved only.
7. **Socket-real-time messaging** — messages persist, but no dedicated chat
   WebSocket infrastructure exists.
8. **Self-hosted video infrastructure** — intentionally not present; calls use
   LiveKit.
9. **Baidu map** — removed from the active map path; current provider is Google.
10. **Guaranteed HEVC playback/transcoding** — upload acceptance exists within
    policy, but there is no independent transcoding service.
11. **Guaranteed push delivery** — center/outbox/banner/push code exists, but
    delivery depends on permission, VAPID, subscription, workers, and browser
    behavior.
12. **Automatic external scholarship application** — discovery and tracking
    exist; Kondo does not submit applications.

## 18. Public organization profiles (Part 3)

Implemented public identity:

- public directory at `/organizations`;
- public profile at `/organizations/[slug]`;
- permission-protected shared-renderer preview at
  `/organizations/[slug]/preview`;
- workspace management at `/organizations/[slug]/public-profile`;
- server-computed readiness and separate `PRIVATE`, `READY`, `PUBLISHED`, and
  `UNPUBLISHED` publication states;
- centralized `ACTIVE + PUBLISHED + unrestricted` public visibility;
- explicit public/private contact channels;
- ordered public gallery through the existing media pipeline;
- stable old-slug redirects through `OrganizationSlugAlias`;
- safe metadata, canonical URLs, bounded sitemap inclusion, Search category,
  and additive Explore city rail;
- shared organization verification mark with a separate partner presentation;
- reports through the existing moderation system;
- permission-protected Admin correction, unpublish, and restriction-lift
  actions with audit, notification, and cache invalidation;
- typed future section providers that stay hidden without real public domain
  content.

Part 4 now supplies Housing listings and roommate matching through their own
domain and projects eligible organization supply into this public page.
Bookings/payments, organization reviews or followers, organization inboxes,
scholarship submissions, job applications, product checkout/orders, automatic
City Hub company conversion, Community membership merging, and
ScholarshipAgent conversion remain intentionally unimplemented.

## 19. Housing (Part 4)

Implemented:

- dedicated personal/organization Housing ownership with database checks;
- reviewable listing lifecycle, private/public location separation and
  provider-neutral map projection;
- bounded search, opaque pagination, saved homes, direct Kondo inquiries,
  Housing requests and automatic expiry;
- authenticated roommate profiles, explainable matching, bidirectional block
  exclusion, interest acceptance and direct-conversation handoff;
- organization workspace, public organization projection, Explore city rail,
  notification category, analytics taxonomy, reports and Admin moderation;
- existing Marketplace Housing data remains readable while new Housing
  products are rejected from the generic seller workflow.

Housing does not implement bookings, payment collection, escrow, contract
generation, legal guarantees, property inspection guarantees, a shared
organization inbox, or AI fraud detection.

## 20. Opportunities (Part 5)

The Opportunities domain is the single source of truth for scholarships,
internships, graduate internships, part-time, full-time and campus jobs,
research opportunities, volunteering, competitions, exchange and summer
programs. It is a dedicated domain: opportunities are never stored as
Marketplace products, Community posts or generic organization content.

Implemented:

- a centralized opportunity-type registry (`src/lib/opportunity-types.ts`)
  owning every label, category, capability requirement, supported publisher,
  allowed application method and indexing decision;
- three publisher kinds — organization, Kondo editorial, and legacy
  ScholarshipAgent — with capability, permission and organization-lifecycle
  checked independently, so enabling a capability never grants a member the
  right to publish;
- a centralized nine-state lifecycle with per-actor transitions
  (`opportunity-lifecycle.ts`); publishers can never assign a moderation state
  and a removed opportunity is restored to review, never straight to public;
- a server-side application-window resolver with a documented seven-day
  "closing soon" threshold, a fixed date plus timezone instead of a live
  countdown, and no trust in the client clock;
- typed scholarship and job detail tables rather than one weak JSON blob;
  absent compensation renders as "Compensation not specified" and benefits
  carry an explicit confirmed / possible / not-specified confidence;
- advisory, explainable eligibility with no opaque score: every rule resolves to
  MET / UNMET / UNKNOWN with a reason, missing profile data yields UNKNOWN and
  never a rejection, and the result is computed per viewer, never cached in a
  shared cache and never exposed to the publisher;
- saved opportunities with opt-in deadline reminders; publishers never see
  saver identities and no save count is exposed publicly;
- five explicit application methods; an external redirect is always labelled as
  leaving Kondo and never reported as a completed submission, and external URLs
  are validated to plain http(s);
- a private candidate document vault on the existing MediaAsset pipeline under
  the dedicated private purpose `OPPORTUNITY_APPLICATION_DOCUMENT`, reusing one
  row across applications instead of copying files, and never serializing a
  storage key;
- a Kondo application workflow whose deadline, duplicate, required-answer and
  required-document checks are re-run inside the submission transaction, with an
  immutable submission snapshot that later profile edits cannot rewrite, and a
  preserved draft when a deadline passes mid-edit;
- a thirteen-state application machine keyed by actor: an applicant cannot
  shortlist or offer themselves, a reviewer cannot act on a draft or a withdrawn
  application, and applicant-visible and internal notes live in separate columns;
- organization application review scoped by `organizationId` with a permission
  set separate from publishing — EDITOR may author and submit opportunities but
  holds no application access — plus single-reviewer assignment;
- Student Hub rails and public organization-page projections that query the live
  domain behind the same visibility rule rather than copying records;
- unified opportunity search plus global-search integration, both restricted to
  publicly eligible records and public columns;
- reporting through the existing Report model with a metadata-only evidence
  snapshot, and platform moderation that hides an opportunity everywhere without
  deleting submitted applications.

ScholarshipAgent compatibility: the legacy `Scholarship`, `ScholarshipUniversity`,
`ScholarshipFavorite` and `ScholarshipAgent` tables are untouched and remain
authoritative for their records. The existing Student Hub scholarship directory
keeps reading them directly and keeps its own canonical URLs. A read-only adapter
(`opportunity-legacy-scholarships.ts`) projects them into unified discovery,
deduplicated against `Opportunity.legacySourceKey`, so one source never appears
twice. No legacy record is migrated, reassigned or given a synthetic
organization. Full migration is deferred.

Opportunities does not implement paid applications, application fees,
recruitment commissions, guaranteed admission, awards or internships,
employment contracts, payroll, employer background checks, immigration or visa
advice, automated rejection on sensitive attributes, black-box ranking, a public
candidate database, or organization reviews.

## 21. Personal and organization workspaces, and route access

Part 5 shipped the Opportunities architecture but not its entry points. This
section records the integration pass that made every user-facing route
reachable. No model, service, permission, route or Opportunities implementation
was duplicated to do it.

### 21.1 Two contexts, one account

Kondo authenticates humans only; organizations never sign in. The same User acts
in two contexts, and the interface must make the active one obvious:

- **Personal workspace** — discover, save, apply, track applications, Student
  Hub, Communities, Marketplace, Housing, Messages.
- **Organization workspace** — manage the organization, publish Housing and
  Opportunities, review applications, manage the public profile, team,
  verification, activity and settings.

Switching workspace never signs the User out. `WorkspaceSwitcher` resolves the
active workspace from the pathname and offers Personal, each membership, and
organization creation. Inside an organization the mobile bar switches to
organization navigation and the drawer exposes **Return to Personal**.

### 21.2 Why organization Opportunities was invisible

Two independent causes, both fixed:

1. `OrganizationWorkspaceShell` built its navigation from a hard-coded array
   that had no Opportunities entry. Navigation is now derived from
   `src/lib/organization-workspace-navigation.ts`, which reads the same
   membership permissions the server routes enforce.
2. `app/organizations/[slug]/opportunities/**` sat _outside_ the `(workspace)`
   route group, so those pages inherited neither the workspace shell nor the
   app shell. They were moved into `(workspace)/opportunities/**`.

A third, smaller orphan: the personal account cluster
(`/opportunities/saved|documents|profile|preferences|applications`) was linked
only by `OpportunityAccountNav`, which rendered _only on those same pages_ — a
closed loop with no way in. That nav is now also rendered from the Student Hub
Applications section.

### 21.3 Organization workspace navigation

Order — Dashboard, Profile, Public profile, Housing, **Opportunities**,
**Applications**, Team, Verification, Activity, Settings. Opportunities sits
immediately after Housing; Applications is a top-level entry because a reviewer
must not have to know an opportunity id to find their queue.

Inside Opportunities: All opportunities, Drafts, Published, Closed,
Applications, and a primary **Create opportunity** action pointing at the
existing `/organizations/[slug]/opportunities/new`.

### 21.4 Capability, permission and setup gating

These stay separate concepts and none implies another:

| Concept                | Source                                                                 |
| ---------------------- | ---------------------------------------------------------------------- |
| Capability             | `SCHOLARSHIPS` or `INTERNSHIPS_JOBS` enabled on the organization       |
| Permission             | `ORGANIZATION_*_OPPORTUNITIES` / `*_APPLICATIONS` from the role matrix |
| Organization lifecycle | `organizationAllowsPublishing()` — a suspension blocks publication     |
| Public profile         | published independently of any opportunity                             |
| Moderation             | platform-side, independent of all of the above                         |

Behaviour by state:

- **Configured and authorized** — Opportunities enabled.
- **Missing capability** — Opportunities stays **visible** in a `setup` state
  and opens a checklist naming the exact missing requirement, with a direct
  link to configure activity areas. It is never silently hidden: an absent entry
  cannot be fixed by the person responsible for fixing it.
- **Incomplete profile** — drafts are still allowed; blocking them would only
  prevent the work that completes setup. Publication is gated separately.
- **Unauthorized member** — the entry is omitted for a member who could not
  open it anyway, and the route stays server-protected regardless.
- **Suspended organization** — publication blocked, restriction explained.

Verification is _not_ required to display the Opportunities entry.

### 21.5 Route-access matrix

Every user-facing Part 5 route and the visible path that reaches it. "Was
orphaned" means it previously required typing the URL.

| Route                                                                             | For       | Visible entry point                                  | Requires                                         | Was orphaned |
| --------------------------------------------------------------------------------- | --------- | ---------------------------------------------------- | ------------------------------------------------ | ------------ |
| `/organizations/[slug]/opportunities`                                             | Publisher | Workspace navigation → Opportunities                 | `ORGANIZATION_VIEW_OPPORTUNITIES`                | Yes          |
| `/organizations/[slug]/opportunities/new`                                         | Publisher | Create opportunity (hero, section, dashboard action) | `ORGANIZATION_CREATE_OPPORTUNITIES` + capability | Yes          |
| `/organizations/[slug]/opportunities/[id]/edit`                                   | Publisher | Edit action on the opportunity row                   | `ORGANIZATION_EDIT_OPPORTUNITIES`                | Yes          |
| `/organizations/[slug]/opportunities/[id]/applications`                           | Reviewer  | Applications count on the opportunity row            | `ORGANIZATION_VIEW_APPLICATIONS`                 | Yes          |
| `/organizations/[slug]/opportunities/applications`                                | Reviewer  | Workspace navigation → Applications                  | `ORGANIZATION_VIEW_APPLICATIONS`                 | New route    |
| `/organizations/[slug]/opportunities/applications/[id]`                           | Reviewer  | Row in either applications list                      | `ORGANIZATION_REVIEW_APPLICATIONS`               | Yes          |
| `/student-hub/scholarships`                                                       | Student   | Student Hub → Scholarships                           | Signed in                                        | No           |
| `/student-hub/internships`                                                        | Student   | Student Hub → Internships                            | Signed in                                        | No           |
| `/student-hub/jobs`                                                               | Student   | Student Hub → Jobs                                   | Signed in                                        | New route    |
| `/student-hub/programs`                                                           | Student   | Student Hub → Programs & Research                    | Signed in                                        | New route    |
| `/student-hub/applications`                                                       | Student   | Student Hub → Applications                           | Signed in                                        | New route    |
| `/opportunities`                                                                  | Student   | Applications → Browse all                            | Public                                           | Yes          |
| `/opportunities/[slug]`                                                           | Student   | Any opportunity card                                 | Public                                           | No           |
| `/opportunities/[slug]/apply`                                                     | Student   | Apply action on the detail page                      | Signed in                                        | No           |
| `/opportunities/applications`, `/saved`, `/documents`, `/profile`, `/preferences` | Student   | Student Hub → Applications → account nav             | Signed in                                        | Yes          |

### 21.6 Unified Scholarships and ScholarshipAgent compatibility

The public **Opportunities / Scholarship agents** tab split is removed. Students
see one Scholarships experience combining unified `Opportunity` records and
legacy `Scholarship` rows in one grid, each card stating _Published by
[publisher]_. Deduplication remains the adapter's job through
`Opportunity.legacySourceKey`.

Legacy architecture is untouched: no ScholarshipAgent model, record, Admin tool
or source relationship was deleted, no organization was synthesised from a
legacy record, and nothing was reassigned by name. `/student-hub/scholarships/agents`
still works and is reachable as _support_ from the Scholarships page — as an
adviser directory, not a competing catalogue of scholarships. Full destructive
legacy migration remains deferred to Part 8.

No example or invented scholarship was created or seeded. When a structured
filter is applied, legacy rows are excluded rather than silently ignoring the
filter, so a filtered list never contains records the filter could not test.

### 21.7 Shared presentation utilities

- `src/components/ui/HorizontalTabs.tsx` — scrollable tab row plus a directional
  panel transition. These are links, so the accessible pattern is a labelled
  `nav` with `aria-current`, not tablist/tab roles. The active tab is scrolled
  into view on the inline axis only, motion is removed under
  `prefers-reduced-motion`, and the row's overflow never becomes the page's.
- `src/components/ui/ClampedText.tsx` — `ClampedTitle` (two lines, no expander)
  and `ExpandableText` (four lines with in-place See more / See less). The
  control appears only after the client measures real truncation, so the server
  and client markup agree. The complete text is always in the DOM: nothing is
  ever shortened at the API or database level for layout reasons.

## 20. Part 7 — personal context and navigation

Journey, Navigator, personalized Home, unified Saved, categorized
notifications and the final personal/organization navigation contract are
documented in [`PART7_JOURNEY_NAVIGATOR.md`](./PART7_JOURNEY_NAVIGATOR.md).
The implementation reuses Student Hub, Discover, Housing, Opportunities,
organization catalog and their existing visibility rules; it creates no second
content source. The canonical Journey is stored separately from the historical
compatibility enum and is changed only after explicit user confirmation.

## 21. Required validation for changes

Minimum code-quality gate:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx prisma generate
```

Database-backed release checks:

```bash
npx prisma migrate status
npx prisma migrate deploy
```

Use `migrate deploy` only against the intended deployment database and only
after reviewing migrations. Never run `prisma migrate dev`, `prisma db push`,
or destructive seed commands against production.

Run `npm run e2e` when UI journeys, navigation, browser providers, media,
permissions, calls, maps, or authentication are changed.

Provider-dependent smoke tests must use the deployed environment:

- registration, verification, login, reset;
- national community membership;
- R2 image/document/video upload and delivery;
- Resend transactional email;
- notification center, foreground banner, OS push, and digest;
- Google map base tiles, university center, radii, and nearby markers;
- two-account LiveKit Random Meet and private call;
- native PDF, scanned PDF, JPEG, PNG, and multi-page timetable import;
- timetable review/confirmation/refresh persistence;
- marketplace create/reload/status/expiry;
- City Hub independent entry save and public publication;
- Story upload/playback/moderation/scheduled publish.

## 22. Copyable instruction block for future AI work

Use the following at the beginning of future implementation prompts:

> You are modifying the existing Kondo modular monolith. Read
> `docs/PROJECT_FEATURE_MAP.md`, `docs/ARCHITECTURE.md`,
> `docs/ENVIRONMENT_VARIABLES.md`, and the relevant domain documentation
> completely before changing code.
>
> First identify the current feature status, pages, components, API routes,
> domain services, schemas, Prisma models, permissions, external providers,
> workers, tests, and downstream impact zones. Do not rebuild an existing
> module, duplicate business logic, or describe a reserved foundation as a
> completed feature.
>
> Preserve Kondo's design system, responsive behavior, accessibility,
> reduced-motion behavior, server-side authorization, same-origin protection,
> Zod validation, centralized visibility rules, audit logging, media privacy,
> notification preferences, and provider abstractions.
>
> For database changes, create and review an additive Prisma migration and
> preserve existing production data. Never use `prisma db push` or a destructive
> seed. For external integrations, keep secrets server-only and extend the
> existing provider boundary.
>
> Before implementation, produce an impact analysis. After implementation,
> report the exact files changed, database/API/provider effects, migrations,
> environment changes, tests run, runtime tests still required, and any
> remaining limitations. Do not claim success based only on compilation.

## 23. Part 8 final release architecture

Part 8 does not introduce a second product architecture. It verifies and closes
the integration of Parts 1–7. The live, executable route inventory and access
policy are documented in
[`ROUTE_ACCESS_MATRIX.md`](./ROUTE_ACCESS_MATRIX.md); the complete release audit
is [`PART8_RELEASE_AUDIT.md`](./PART8_RELEASE_AUDIT.md).

Final cross-domain rules:

- Organization capability never grants member permission.
- Opportunity is the source for new opportunity publishing; legacy Scholarship
  and ScholarshipAgent records remain read-only compatible sources.
- Discover, Dynamic City Hub and Essentials project source records without
  copying them.
- Marketplace remains peer-to-peer and cannot inherit Organization trust.
- personalized Home, Journey, Navigator, applications, messages,
  notifications, Saved and organization workspaces are private, dynamic data.
- exact Housing locations and reporter identity require separate Admin
  permissions and generate audited access events.
- payments and university billing remain provider-disabled, with no fake rate,
  currency, provider, status or checkout.

The read-only legacy reconciliation is `npm run legacy:audit`; the route,
permission, entry-point and analytics-boundary audit is
`npm run release:audit -- --summary`.
