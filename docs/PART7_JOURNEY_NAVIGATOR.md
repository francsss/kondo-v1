# Part 7 — Journey, Navigator and final navigation

## Canonical Journey

`UserJourneyDetail.journeyGroup` and `journeyStage` are the canonical personal
context. Group and stage are stored separately and validated by
`src/lib/journey.ts`. The historical `User.studentJourney` field remains a
compatibility projection for earlier features; it is not a second product
choice. `ADMITTED` and `PREPARING_ARRIVAL` remain in `PREPARING_FOR_CHINA`.

Users choose one of three groups during personal onboarding, then only the
stages belonging to that group. A later transition is explicit and confirmed
from Home. Kondo never infers or silently advances a stage from activity.

## Kondo Navigator

`src/features/navigator/registry.ts` is the deterministic rule registry. Every
action has a stable key, internal route, reason, priority and predicate. Rules
receive bounded counts and completion booleans only; they never receive
messages, application answers, private documents or generative output. A rule
that depends on public content is omitted when that content count is zero.

`UserNavigatorActionState` privately persists completion, dismissal and a
bounded deferral. The action endpoint derives the user from the authenticated
session and accepts only registry keys. The recommendation itself never grants
access; every destination retains its own server authorization.

## Personalized Home and Saved

Home displays the confirmed Journey and up to four real Navigator actions
before its existing real feed, guides, communities, events and Marketplace
content. Empty source domains are not represented with fabricated progress.

`/saved` is a private projection over the existing source-owned save tables for
opportunities, housing, organization products/services and Marketplace. It does
not copy source records. Every read rechecks source visibility. Removed content
returns a neutral unavailable card with no hidden data or action route.

## Navigation contract

Personal primary navigation is Home, Student Hub, Discover, Communities and
Messages. Housing, Student Stories, Saved and Marketplace remain discoverable
as secondary services. Organization workspaces replace personal navigation;
their mobile primary bar is exactly Dashboard, Housing, Opportunities,
Applications and More. Products and Services are distinct desktop entries and
More contains the remaining permission-filtered workspace routes, workspace
switching and Return to Personal.

## Route-access matrix

| Route                                              | Audience                      | Purpose                        | Entry point            | Authorization                                 | Empty/error behaviour     |
| -------------------------------------------------- | ----------------------------- | ------------------------------ | ---------------------- | --------------------------------------------- | ------------------------- |
| `/home`                                            | authenticated personal user   | personalized start             | personal nav           | session                                       | real empty states only    |
| `/api/journey`                                     | same user                     | read/update Journey            | Home/onboarding        | session + same origin + enum/group validation | private JSON error        |
| `/api/navigator/actions/[actionKey]`               | same user                     | persist action state           | Navigator              | session + same origin + registry key          | 404 unknown key           |
| `/student-hub/*`                                   | authenticated personal user   | academic/opportunity workspace | personal nav           | session + domain authorization                | domain empty states       |
| `/discover`                                        | authenticated personal user   | cross-domain discovery         | personal nav/search    | source visibility policies                    | empty providers omitted   |
| `/saved`                                           | authenticated personal user   | unified private saves          | secondary nav          | session + source visibility recheck           | unavailable neutral card  |
| `/notifications`                                   | authenticated personal user   | categorized updates            | header bell            | recipient isolation                           | calm empty category state |
| `/organizations/[slug]/dashboard`                  | active organization member    | workspace start                | workspace switcher     | active membership                             | not found/forbidden       |
| `/organizations/[slug]/housing`                    | permitted organization member | housing publishing             | org mobile/desktop nav | capability + permission                       | setup state               |
| `/organizations/[slug]/opportunities`              | permitted organization member | opportunity publishing         | org mobile/desktop nav | capability separate from permission           | setup checklist           |
| `/organizations/[slug]/opportunities/applications` | owner/admin only              | application review             | org mobile/desktop nav | application permission; EDITOR excluded       | forbidden/no applicants   |
| `/organizations/[slug]/catalog/products`           | catalog viewers               | product management             | org desktop/More       | product capability + permission for mutation  | setup/empty state         |
| `/organizations/[slug]/catalog/services`           | catalog viewers               | service management             | org desktop/More       | service capability + permission for mutation  | setup/empty state         |

## Analytics and release

Part 7 adds Journey, Navigator, personalized Home and Saved event constants.
Payloads contain only group/stage, stable action key and counts. No search text,
message content, application answer or document name is allowed.

Migration `20260801150000_part7_journey_navigator` is additive and idempotent.
It backfills canonical Journey values from historical fields and creates only
the private Navigator state table. No environment variable or provider is
added. Part 8 remains out of scope.
