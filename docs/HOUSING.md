# Kondo Housing

Housing is a first-class Kondo domain. It is not a Marketplace category and it
does not duplicate City Hub editorial content.

## Boundaries

- `HousingListing` owns structured, filterable home supply.
- `HousingRequest` owns a member's time-limited statement of need.
- `RoommateProfile` and `RoommateInterest` own private member matching.
- Organizations remain the source of their identity and team permissions.
- `MediaAsset` remains the source of uploaded files and scan state.
- `Conversation` remains the only direct-message transport.
- `Report` remains the moderation intake.
- City Hub only renders a bounded projection of live Housing records.
- Existing Marketplace housing rows remain readable, but new housing supply
  must use Housing.

## Publisher policy

Personal publishers may create private rooms, shared rooms, roommate
replacement listings and sublets. Organization publishers require:

1. an active organization;
2. an enabled `HOUSING` capability;
3. an active membership;
4. the relevant dedicated Housing permission.

The publisher identity is immutable after creation. Organization inquiries are
delivered to a designated active Kondo representative; no shared organization
inbox is fabricated.

## Listing lifecycle

`DRAFT → PENDING_REVIEW → PUBLISHED → PAUSED | RENTED | EXPIRED → ARCHIVED`

Rejected listings return to draft after correction. Removed listings are
hidden from search, map, recommendations, organization projections, City Hub
and the sitemap. Approval and rejection require Housing review permission;
removal requires the separate Housing removal permission. Client payloads
never set lifecycle or moderation fields directly.

Published listings expire after 60 days. The authenticated internal endpoint
`/api/internal/housing/expire` expires listings and Housing requests. The
existing GitHub Actions production-worker workflow invokes it hourly with
`CRON_SECRET`; `HOUSING_WORKER_SECRET` remains available for a separate
operator-owned scheduler.

## Location privacy

Exact coordinates and `privateAddress` are private database fields and are
never part of a public DTO.

- `DISTRICT_ONLY`: no map point.
- `APPROXIMATE_AREA`: deterministic 450–1,300 m displacement.
- `NEAR_UNIVERSITY`: deterministic 180–600 m displacement.
- `EXACT_AFTER_CONTACT`: public map remains displaced.
- `PUBLIC_EXACT_LOCATION`: organization-only and explicit.

The public map API reads only `publicLatitude` and `publicLongitude`. Database
constraints require coordinate pairs, valid bounds and prohibit a personal
publisher from selecting exact public location.

## Media

Housing media uses the existing signed upload, validation, scan, ownership and
delivery lifecycle.

- `HOUSING_LISTING_IMAGE`: public only while its listing is publicly visible.
- `HOUSING_FLOOR_PLAN`: follows the public listing.
- `HOUSING_PROOF_DOCUMENT`: always private; accessible only to an eligible
  publisher or an Admin with `HOUSING_PROOF_VIEW`.

There is one cover per listing, stable ordering, 16 public-image maximum and
five private-proof maximum. Public responses exclude proof relationships.

## Search and map

Search is bounded to 30 results per request and filters status, expiry,
publisher eligibility, city, university, type, rent, availability, furnishing,
amenities and policies at the database boundary. Cursors are opaque and capped.

Map responses are capped at 120 points, use the provider-neutral map adapter
already used by Meet, and fall back to an accessible list when the configured
provider is unavailable. The fallback never synthesizes or reveals exact
location.

## Requests and roommates

Housing requests are draft-first and may be public, member-only or
matching-only. Contact details are not stored in the public request record.

Roommate discovery is authenticated and noindex. A profile is visible only
when active, member-visible, not expired, accepting interests and not blocked
in either direction. Compatibility reasons are explanatory, not a hidden
score. A direct conversation becomes available only after the recipient accepts
an interest.

## Cache and projections

`revalidateHousing` invalidates Housing home/search/map/manage/saved routes,
the listing page, global search, sitemap, related organization page and City
Hub. Public organization Housing sections only appear when the capability is
enabled and live public supply exists.

## Route inventory

Public:

- `/housing/listings/[id-or-slug]`
- `GET /api/housing/listings`
- `GET /api/housing/listings/[id-or-slug]`
- `GET /api/housing/map`

Authenticated application:

- `/housing`
- `/housing/search`
- `/housing/map`
- `/housing/create`
- `/housing/manage`
- `/housing/manage/[id]`
- `/housing/saved`
- `/housing/requests`
- `/housing/roommates`
- `/housing/roommates/[id]`
- `/organizations/[slug]/housing`

Protected APIs live below `/api/housing` and enforce trusted origin, session,
Zod validation, rate limits where abuse is possible, ownership/organization
authorization, lifecycle rules, auditing, cache invalidation and safe DTOs.

Admin:

- `/admin/housing`
- `/admin/housing/[id]`

## Operational checks

Before release:

```bash
npx prisma validate
npx prisma migrate deploy
npm run lint
npm run typecheck
npm test
npm run build
```

Runtime checks must cover anonymous public listing access, signed-in save and
inquiry, organization publication, Admin moderation, map fallback, roommate
block behavior and expiry worker authorization.
