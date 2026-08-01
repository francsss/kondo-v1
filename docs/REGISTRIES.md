# Final domain registries

Last audited: 2026-08-01

This document points to executable registries. The source files—not copied UI
arrays—are authoritative.

## Organization capabilities

Source: `src/lib/organization-capabilities.ts`

- Housing
- Scholarships
- Internships & jobs
- Products
- Student services
- Events
- University information

A capability controls whether the organization may operate in a domain. It
never grants a member permission. Member actions use
`src/lib/organization-authorization.ts` and domain permission helpers.

## Discover providers

Source: `src/features/discover/registry.ts`

- Organizations
- Housing
- Opportunities
- Organization products
- Organization services
- Marketplace
- Communities
- Universities
- Cities
- Events

Each provider returns a typed public DTO, uses a source visibility rule, bounds
its query and publishes only category-level analytics metadata. Dynamic City Hub
calls the same providers with a city filter; Kondo Essentials projects Housing
and Organization catalog rather than copying records.

## Media purposes

Source: `src/lib/media-policy.ts`

Public-context purposes include Community cover, Post image, Listing image,
Guide cover, Story video and Story poster. Relation-gated/private purposes
include Profile avatar, Organization logo/cover/gallery, Organization
verification, Housing images/floor plans/proof, message files, schedule import,
official verification, Opportunity cover/application documents and
Organization product/service images.

Every Prisma `MediaPurpose` must have exactly one policy defining kind,
visibility, maximum size, MIME/extensions, dimensions and alt-text behavior.
Signature validation is separate. Private assets can be projected publicly only
through an authorized visible source relation; private documents never become
public gallery media.

## Notification registry

Sources: `src/lib/notifications.ts`,
`src/features/notifications/presentation.ts`

Product categories shown to Users:

- Applications
- Opportunities
- Housing
- Organizations
- Products and services
- Messages
- Payments and invoices
- System

Template keys declare required variables centrally. Jobs require dedupe keys,
respect recipient preferences, and normalize destinations to an internal safe
route. Worker retries do not fabricate success.

## Analytics registry

Sources: `src/lib/product-analytics-events.ts`, `src/lib/analytics.ts`,
`src/lib/product-analytics-client.ts`, `src/lib/product-analytics-server.ts`

The event taxonomy covers authentication/onboarding, Journey/Navigator/Home,
Organizations, Communities, Meet, messaging, Marketplace, Housing,
Opportunities, Discover/Essentials, catalog, Student Hub, Explore,
notifications, Stories, official profiles, Kondo Pet and reliability.

Raw PostHog capture/identify/reset calls are restricted to the analytics
adapters/components and enforced by `npm run release:audit`. Properties are
primitive, length-bounded and reject email, message/content, passwords, tokens,
file names and search text. Dynamic route identifiers and query strings are
normalized before capture.

## Public cache ownership

| Source mutation                       | Canonical invalidation owner    | Public consumers invalidated                                                                            |
| ------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Organization/public profile/lifecycle | `organization-cache.ts`         | Directory, profile/alias, Search, Discover, Essentials, City Hub, sitemap                               |
| Housing                               | `housing-cache.ts`              | Housing, Search/map, Discover, Essentials, City Hub, organization projection, sitemap                   |
| Opportunity                           | `opportunity-cache.ts`          | Opportunity pages, Student Hub categories, Search, Discover, City Hub, organization projection, sitemap |
| Product/service                       | `organization-catalog-cache.ts` | Detail, organization catalog/profile, Search, Discover, Essentials, City Hub                            |

Home, Journey, Navigator, Saved, messages, notifications, applications,
organization private workspace and payment status must never use shared public
caches.

## Journey and Navigator

Sources: `src/lib/journey.ts`, `src/lib/journey-service.ts`,
`src/features/navigator/registry.ts`, `src/lib/navigator.ts`

Journey group and stage remain separate. Registry rules have stable unique
keys, executable internal routes, a real-state predicate, priority, required or
recommended status, and a reason. User action state supports completion,
dismissal and bounded deferral. See `PART7_JOURNEY_NAVIGATOR.md`.
