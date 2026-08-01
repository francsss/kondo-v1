# Part 8 — final release audit

Audit date: 2026-08-01

Baseline Git commit: `b053634900bcc73d91052dc53aee68e009b7177a`

Release recommendation: **READY WITH CONDITIONS**

The core Kondo platform is release-ready when the command and deployment gates
in this document pass. “With conditions” means external capabilities remain
truthfully disabled until their real credentials/contracts are configured; it
does not authorize fake or simulated payment, billing, maps, AI, email, push, or
calling behavior.

## 1. Inventory and architecture map

Kondo is a Next.js modular monolith with PostgreSQL/Prisma as persistence. The
live inventory contains 173 pages, 262 API routes, 47 Admin pages, 64 Admin API
routes, 60 additive Prisma migrations, 103 Vitest files and the Playwright
journey suites under `e2e/`. `npm run release:audit` derives route counts from
source and fails policy drift.

| Domain                         | Source of truth                                          | State                          | Public projections                                         |
| ------------------------------ | -------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------- |
| Identity/onboarding            | `User`, `UserJourneyDetail`, reference data              | Active                         | Profile-safe DTOs only                                     |
| Journey/Navigator/Home         | Journey service + deterministic Navigator registry       | Active                         | None; always private                                       |
| Organizations                  | Organization domain/services                             | Active                         | Directory, profile, Discover, City Hub, Search             |
| Communities                    | Community/Post domain                                    | Active                         | Home, Discover, Search, Stories context                    |
| Housing/roommates/requests     | Housing domain                                           | Active                         | Housing, Discover, City Hub, organization page             |
| Opportunities/applications     | Opportunity domain                                       | Active                         | Student Hub, Discover, Search, City Hub, organization page |
| Legacy scholarships/agents     | Legacy tables                                            | Compatibility-only, retained   | Read-only scholarship adapter                              |
| Organization products/services | Organization catalog                                     | Active                         | Organization page, Discover, City Hub, Essentials          |
| Marketplace                    | Marketplace domain                                       | Active and separate            | Marketplace, Discover                                      |
| Discover/City Hub/Essentials   | Provider registries                                      | Active aggregation             | No copied source records                                   |
| Messages/notifications/saved   | Their source relations                                   | Active and private             | No shared public cache                                     |
| Media                          | `MediaAsset` + purpose registry + relation authorization | Active                         | Public delivery only after source visibility checks        |
| Analytics                      | Central event registry/adapters                          | Active when PostHog configured | Sanitized metadata only                                    |
| Payments/university billing    | Adapter contracts                                        | Provider-disabled              | Truthful unavailable page only                             |

## 2. Final source-of-truth decisions

- Opportunity is the only source for new scholarships, internships, jobs,
  research and programs. Legacy Scholarship/ScholarshipAgent rows are retained
  and projected read-only without duplicate cards.
- Discover, City Hub and Essentials aggregate authoritative domains; they do
  not persist copied products, services, Housing, Opportunities, Communities,
  Marketplace or Organizations.
- Marketplace remains peer-to-peer. Organization catalog trust, verification,
  inquiry context and lifecycle never transfer to personal Marketplace items.
- Journey group and stage are separate. Legacy `StudentJourney` is a compatible
  input, not a reason for destructive rewriting.
- Saved items retain references and become an “unavailable” state after source
  removal instead of leaking stale copied data.

## 3. Security corrections in Part 8

- Candidate application lists now require
  `OPPORTUNITY_APPLICATIONS_VIEW`, rather than general Opportunity visibility.
- Reporter identity is absent from moderation queue DTOs. It is visible only in
  a specific case with `REPORT_VIEW_REPORTER_IDENTITY`; every reveal writes an
  AuditLog without recording the identity value.
- Exact Housing addresses require `HOUSING_PRIVATE_LOCATION_VIEW`, are queried
  only for that role, and every access is audited. Publisher email was removed
  from Housing list/detail selects where it was unused.
- Housing moderation buttons now mirror review/remove permissions; the server
  remains authoritative.
- Product/service moderation has dedicated view/moderate permissions, a real
  Admin entry, validated moderation transitions, required internal notes,
  publisher notifications, AuditLog and public projection invalidation.
- Admin message-safety and presence APIs now authorize explicitly with the
  shared Admin API guard.
- Opportunity reports redirect into the shared report system, so report text,
  reporter identity, evidence and assignment retain one authorization model.

## 4. Permissions and sensitive data

Global Admin roles map to explicit permissions; `SUPER_ADMIN` is not inferred
from a client claim. Organization capability and member permission remain
separate. Editors do not receive application access. Removed members fail the
database membership check on the next request. Suspended Organizations fail
public visibility rules across source modules.

Admin lists do not load passports, private application answers/documents,
private messages, exact Housing coordinates, payment credentials, or internal
reviewer notes. Full evidence and security metadata remain separate permissions.

See `ADMIN.md` and `ROUTE_ACCESS_MATRIX.md`.
Executable domain registries and cache ownership are summarized in
[`REGISTRIES.md`](./REGISTRIES.md).

## 5. Journey, Navigator and personalized Home

The visible groups and compatible stages remain those documented in
`PART7_JOURNEY_NAVIGATOR.md`. An admitted User outside China remains in
`PREPARING_FOR_CHINA`. Journey mutations are User-controlled; Navigator may
suggest but cannot force a transition. Navigator rules are deterministic,
unique, explainable, internal-route-only, real-state-based and bounded. Private
message/report content, exact locations, application answers and private
documents are excluded.

Home is one personalized surface. Empty rails are omitted and progress derives
from actual requirements. Home, Navigator, Saved, applications and notifications
are force-dynamic/private and never use shared public cache entries.

## 6. Student Hub and Opportunity verification

The visible Student Hub categories are Overview, Scholarships, Internships,
Jobs, Programs & Research, and Applications. The old generic Opportunities tab
is removed; its URL is a redirect. Every Opportunity type is mapped to exactly
one section. Organization publication remains a separate workspace workflow.

Application answers, candidate documents and internal reviewer notes are not in
list DTOs or notification/analytics payloads. External URLs are HTTP(S)-only and
can be blocked independently of lifecycle.

## 7. Public aggregation and cache strategy

All Discover providers have a stable resource type, source domain, bounded
query, explicit select, public visibility predicate and safe recommendation
reason. Dynamic City Hub resolves English/Chinese aliases and omits empty
groups. Exact Housing locations never enter its DTO. Jiaxing remains a pilot
editorial source without fake production records.

Organization, Housing, Opportunity and catalog changes revalidate their detail,
Search, Discover, Essentials where relevant, Student Hub projections and the
affected Dynamic City Hub. Private pages are not shared-cached.

## 8. Media, notifications and analytics

Media purposes are exhaustively mapped in `MEDIA_POLICIES`. SVG is unsupported;
MIME, extension, signature, size and image dimensions are checked. Active PDF
actions/embedded files and the EICAR test signature are rejected. Candidate,
verification, Housing proof, message and schedule files are private and require
owner/domain authorization. Storage keys never enter public DTOs.

Notification destinations pass an internal-route normalizer, jobs use dedupe
keys, reminders are idempotent and removed resources resolve safely. Messaging
inquiries remain scoped to the actual participant/authorized organization role.

PostHog calls are confined to the analytics components/adapters. The property
sanitizer rejects content, message, email, password, token, file-name and search-
query fields; route identifiers and query strings are normalized.

## 9. Legacy, migrations and rollback

Part 8 requires no schema or data transformation, so it adds no migration. The
read-only `npm run legacy:audit` checks source-key duplicates, ScholarshipAgent
retention, slug aliases, Journey inference candidates and Marketplace Housing
candidates. It performs zero writes.

The current 60 migrations are additive release history. Production uses
`prisma migrate deploy`, never `prisma db push`. Rollback is application-first:
redeploy the previous compatible commit, leave additive columns/tables in place,
and compensate data only with a separately reviewed script. See
`LEGACY_COMPATIBILITY.md` and `PRODUCTION_READINESS.md`.

The Part 8 dry run replayed all versioned migrations into an isolated shadow
database and compared that result with the disposable release database using
`prisma migrate diff --from-migrations ... --to-url ... --exit-code`. It
reported `No difference detected`. This history-to-database comparison is the
release drift gate. A direct database-to-datamodel comparison is intentionally
not used as a zero-diff gate because Prisma cannot fully express the generated
PostgreSQL `tsvector` defaults, GIN indexes, trigger-managed constraints and
some database-truncated index names committed in the SQL migration history.

## 10. Provider status

| Provider/capability         | State                             | Missing contract/credential behavior                                      |
| --------------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| Payment/university billing  | Provider-disabled                 | No Pay Now, currency, quote, completion or supported-country claim        |
| PostHog                     | Optional                          | Application works; analytics capture is skipped                           |
| Web Push                    | Optional                          | In-app notifications continue                                             |
| Google Maps                 | Optional for map enhancement      | Safe non-provider fallback remains                                        |
| LiveKit                     | Production-configured requirement | Calling surface fails safely; unrelated modules continue                  |
| DeepSeek timetable analysis | Production-configured requirement | Import reports a clear provider error; unrelated modules continue         |
| Resend                      | Production-configured requirement | User action reports delivery failure; data mutations do not fake delivery |
| R2                          | Required for production media     | Upload fails closed; private files never fall back to public storage      |

## 11. Verification gates

Required before release:

```text
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx prisma generate
npx prisma migrate status
npm run release:audit -- --summary
npm run legacy:audit
```

Then run the complete Playwright suite against a production build, verify the
canonical deployed domain and `/api/health`, inspect deployment logs/migrations,
and confirm the deployed commit matches GitHub `main`.

Part 8 local evidence on the isolated release database: 617 Vitest tests passed,
81 Playwright tests passed against the production build, all 60 migrations were
current, the migration-history dry run found no difference, and the Next.js
production build completed successfully. Deployment evidence is recorded only
after the final commit reaches production.

## 12. Known limitations and conditions

- No live payment or university billing provider is configured.
- Payment adapter contracts are not persisted until legal/provider review.
- Full browser journeys that depend on third-party provider credentials require
  the production environment; provider-disabled states are the required result
  otherwise.
- Legacy records are retained intentionally. Absence of test-database legacy
  rows is not evidence that production has none; run the read-only audit against
  production through the approved operator process.
- Automated accessibility/browser tests complement, but do not replace, final
  assistive-technology and real-device acceptance testing.

## 13. Launch decision

Recommend **READY WITH CONDITIONS** when all command gates, Playwright suites,
deployment and smoke tests pass. Do not change the recommendation to READY for
payments, university billing, or another optional integration until a real
provider contract, credentials, compliance review and production test evidence
exist.

The operator checklist is
[`PRODUCTION_LAUNCH_CHECKLIST.md`](./PRODUCTION_LAUNCH_CHECKLIST.md).
