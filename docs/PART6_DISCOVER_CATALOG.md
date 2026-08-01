# Part 6 — Discover and organization catalog

## Baseline and impact

Part 6 was built on `main` after fast-forwarding the two existing Part 5
follow-up commits. Discover is an aggregation layer: the source domain remains
authoritative and no universal copied `DiscoverItem` table exists.

Public source records are read through a typed provider registry in
`src/features/discover/registry.ts`. Every provider owns its route builder,
analytics source, cache tags and source-domain visibility predicate. The
registry currently exposes organizations, Housing, Opportunities, organization
products, organization services, peer Marketplace listings, Communities,
universities, cities and validated community events.

## Route inventory

Public and signed-in discovery:

- `/discover` — unified discovery, instant query and resource/city filters
- `/explore` — permanent compatibility redirect to `/discover`
- `/discover/cities/[slug]` — dynamic City Hub from source-domain projections
- `/discover/essentials` — journey-oriented real-content projection
- `/discover/saved` — private saved products and services
- `/products/[slug]` and `/services/[slug]` — public catalog details
- `/payments` — explicit provider-disabled payment readiness state

Organization workspace:

- `/organizations/[slug]/catalog`
- `/organizations/[slug]/catalog/products/new`
- `/organizations/[slug]/catalog/products/[resourceId]`
- `/organizations/[slug]/catalog/services/new`
- `/organizations/[slug]/catalog/services/[resourceId]`
- `/organizations/[slug]/catalog/inquiries`

The matching organization and public action APIs live under
`/api/organizations/[id]/{products|services}` and
`/api/{products|services}/[id]`. Catalog moderation reuses the admin/report
permission model through `/api/admin/catalog/[kind]/[id]/moderate`.

## Product and service architecture

Products and services are independent professional organization domains. They
do not reuse `MarketplaceListing`, whose owner and lifecycle remain peer-to-peer.
Both catalog domains have separate lifecycle enums, media relations, saves and
inquiries. Shared policy functions exist only where the rule is truly common.

Capability and permission are evaluated independently. `PRODUCTS` or
`STUDENT_SERVICES` enables a domain for an organization, while member role
permissions separately control view, create, edit, publish, archive and inquiry
access. An editor may prepare drafts but cannot publish them.

The one public exposure policy is
`src/lib/organization-catalog-visibility.ts`. A record is visible only when it
is published, not moderation-blocked, owned by an active organization with a
published and unblocked profile, and backed by the matching enabled capability.
Search, Discover, City Hub, Essentials, public profiles and saved content all
reuse this policy. Suspensions and removals therefore disappear everywhere.

## Media, messaging, notifications and moderation

Catalog images reuse the guarded `MediaAsset` upload, scan and attachment
pipeline with explicit product/service purposes and size/MIME policies.
Contextual inquiries reuse direct Kondo conversations. The existing message
notification job is enqueued immediately for the organization recipient; no
parallel inbox or notification implementation was created.

Reports reuse the existing private `Report` domain. The specific catalog reason
is preserved in the private details while it maps to the existing moderation
reason vocabulary. Admin moderation can remove a resource, block its external
URL or restore it to `PENDING_REVIEW`—never directly to public visibility.
Publisher endpoints expose only save state, never saver identities.

## Kondo Essentials and City Hub

Essentials groups real published records by practical journey themes. Empty
themes remain empty rather than receiving fabricated listings. City Hub
normalizes compatible English and Chinese aliases and then queries each
registered source by the canonical city ID. Exact Housing locations remain
protected by the Housing public DTO/policy.

Jiaxing requires no hard-coded content: it becomes useful as real records are
published and receives the same explicit empty states as every other city.

## Payment-ready limitation

No payment provider is configured. `PaymentProviderAdapter` and
`UniversityBillingAdapter` define future integration boundaries, while the
current capability is explicitly disabled. Kondo does not create rates,
currencies, payment links, QR codes, success states or transaction records.
An authorized provider must own fund collection, KYC, compliance, FX,
settlement and refunds before payment can be enabled.

## Navigation and performance

Horizontal sections use real URLs with `scroll={false}`, keep the active item
visible on narrow screens and animate only the newly selected panel. Query-based
tabs participate in the transition key, deep links remain reloadable and
reduced-motion users receive no movement. Organization profile sections now
render one focused page-like panel instead of jumping down a long anchor page.

Discover queries are bounded and never cache personalized results under a
shared identity. Recommendations use only the signed-in user's city,
university and journey plus public content; messages, application answers,
documents, reports and sensitive profile fields are excluded.

## Database

Migration `20260801090000_part6_organization_catalog` is additive and
idempotent. It creates the product/service records, media, saves and inquiries,
plus enums, constraints and indexes. It was designed for `prisma migrate deploy`
and may be retried without failing on existing enums, tables, constraints or
indexes. `prisma db push` is not used.
