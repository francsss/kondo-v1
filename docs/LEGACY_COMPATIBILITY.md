# Legacy compatibility and migration policy

Last audited: 2026-08-01

Kondo uses additive compatibility. No record is merged because two names look
similar, and no legacy table is removed until a separately reviewed migration,
rollback plan, and production reconciliation prove that removal is safe.

Run the read-only reconciliation with:

```bash
npm run legacy:audit
```

The command performs no writes, reports duplicate source keys, and deliberately
fails if a deduplication invariant is violated.

| Legacy or overlapping concept               | Final source of truth                                                                   | Compatibility                                                                                                  | Migration/retention decision                                                               | Rollback                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `Scholarship`                               | Existing rows remain authoritative for themselves; new publications use `Opportunity`   | `opportunity-legacy-scholarships.ts` projects read-only cards and suppresses rows claimed by `legacySourceKey` | Retain. No automatic conversion or deletion                                                | Disable projection; legacy directory remains canonical |
| `ScholarshipAgent`                          | Legacy agent record                                                                     | Read-only publisher relation and existing public agent directory                                               | Intentionally retained; never auto-create Organization                                     | Remove projection relation without touching agent row  |
| `Company` / Organization-like references    | `Organization` for professional workspace; old references retain their domain ownership | Explicit adapters/links only                                                                                   | Never merge by normalized name                                                             | Keep original reference and remove adapter             |
| Explore                                     | `Discover` aggregation                                                                  | `/explore` redirects; city detail supports existing editorial fallback                                         | Compatibility alias retained                                                               | Restore route implementation without data migration    |
| Static City Hub editorial data              | Dynamic City Hub providers for source content; `CityHub` for editorial copy             | `resolvePublishedCity` and the city registry are fallback-compatible                                           | Retain until every supported city has reviewed editorial data                              | Continue serving static registry                       |
| Organization-owned Marketplace records      | Organization Product/Service is the professional source; Marketplace remains personal   | No trust badge inheritance and no automatic copy                                                               | Review manually if historic records exist                                                  | Leave Marketplace record unchanged                     |
| Housing inside Marketplace                  | `HousingListing` for Housing; Marketplace listing remains peer-to-peer                  | Read-only audit flags possible candidates by category name                                                     | No automatic move because address, owner, privacy, and lifecycle cannot be inferred safely | No writes to roll back                                 |
| Old onboarding `StudentJourney`             | `UserJourneyDetail.journeyGroup` + `journeyStage`; legacy field remains compatible      | `inferJourney` maps old values at read time                                                                    | User-controlled updates only; no destructive profile rewrite                               | Continue inference from legacy value                   |
| Old organization roles `MANAGER` / `MEMBER` | `OWNER`, `ADMIN`, `EDITOR`, `VIEWER`                                                    | Permission helper maps Manager→Editor and Member→Viewer                                                        | Retain enum compatibility until production reconciliation                                  | Older binary can still read legacy values              |
| Old organization slugs                      | Canonical `Organization.slug`                                                           | `OrganizationSlugAlias` permanent redirect                                                                     | Retain aliases; never reuse them for another organization                                  | Restore prior canonical slug and alias direction       |
| Old Opportunity category URLs               | Central Opportunity search                                                              | Redirect with category query                                                                                   | Retain stable bookmarks                                                                    | Redirect target can be changed without data writes     |
| Old Student Hub Opportunities tab           | Final category-specific Student Hub                                                     | Compatibility redirect only                                                                                    | Retain route, never restore duplicate navigation entry                                     | Redirect can point to another canonical projection     |
| Old saved records                           | Source domain remains authoritative                                                     | Unified Saved stores references and rechecks visibility                                                        | Retain unavailable placeholder; do not copy private content                                | Read original relation directly                        |
| Old notifications                           | Notification row and template registry                                                  | Safe destination normalizer rejects missing/unsafe routes                                                      | Retain historical rows                                                                     | Fallback to `/notifications`                           |
| Old media purposes                          | `MediaPurpose` policy registry                                                          | Each purpose remains explicit and private/public delivery is relation-aware                                    | Retain; no private-to-public reuse                                                         | Revoke relationship or mark asset removed              |

## Deduplication

Legacy scholarships use a stable `legacy-scholarship:<id>` source key. Imported
sources must additionally compare official source identifier/URL, normalized
title, publisher, deadline, and a content signature before a migration is ever
approved. A title match alone is never sufficient.

## Data migration procedure

No Part 8 data transformation is required. If a future reconciliation requires
one, it must be implemented as a dedicated script with `--dry-run` as its
default, explicit counts, duplicate output, bounded transactions, safe rerun,
and a compensating rollback script. Production execution requires a backup and
an operator-confirmation flag. `prisma db push` and destructive production seed
operations remain prohibited.
