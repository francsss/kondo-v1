# Kondo — Complete Technical & Product Audit

Date: 2026-07-15  
Application version audited: `0.4.0`  
Audit documentation release: `0.4.1`  
Status: Official implementation snapshot and single source of truth

> Remediation status (application `0.4.2`): the critical Search serialization/authentication exposure, private-community read leaks, normal-user lifecycle visibility gaps, unvalidated favorite/vote/progress/reaction targets, unsupported member trust badges, and accidental production seed risk identified below were corrected in the 0.4.2 security stabilization. The body of this document remains the historical evidence-based audit of 0.4.0; current operating rules are documented in `API.md`, `ARCHITECTURE.md`, `SECURITY.md`, and `DEPLOYMENT.md`.

## 1. Audit mandate and method

This document describes only what exists in the audited source tree. It does not treat roadmap language, schema readiness, disabled controls, or visual affordances as implemented behavior. No application code, route, schema, API, or design was changed to produce this audit.

Evidence reviewed:

- every page and route handler under `app/`;
- every reusable component, feature registry, query, validation, authentication, authorization, messaging, audit, and rate-limit helper under `src/`;
- the complete Prisma schema, both SQL migrations, and the destructive demo seed;
- all project documentation, configuration, declared dependencies, installed top-level dependencies, and all six test files;
- a production build route manifest generated from an exact disposable copy of the audited source.

Verification on the audited source:

- `npm run lint`: passed;
- `npm run typecheck`: passed;
- `npm test`: passed — 6 files, 17 tests;
- `npm run build`: passed — 31 application page routes plus 22 API route files/32 HTTP operations;
- `npm audit --omit=dev`: 2 moderate findings from the same transitive PostCSS advisory through Next.js; no high or critical registry advisory was reported.

No Git metadata exists in the audited directory, so this snapshot cannot be tied to a commit SHA. The application package reports version `0.4.0`.

### Status legend

- ✅ Fully implemented: the current intended MVP path works end to end.
- 🟡 Partially implemented: meaningful UI or backend exists, but the user or operator loop is incomplete.
- ⚪ Placeholder: visual, schema, or architectural preparation exists without an operable feature.
- ❌ Missing: no current implementation was found.

Completion percentages are audit estimates against the scope visibly represented by the current product and data model. They are not test coverage percentages.

## 2. Executive findings

Kondo is a coherent, buildable modular-monolith MVP with a strong responsive shell, database-backed authentication, substantial read experiences, several working member mutations, and reusable foundations for community, guides, messaging, and city content. Its implementation maturity is estimated at **53%** across the modules represented by the product.

1. **Critical pre-production data exposure:** `GET /api/search` is public and returns the raw result of `searchKondo()`. The `users` results are complete Prisma `User` objects, and each `posts[].author` is also a complete `User` object. These include internal fields such as `passwordHash`, email, phone, role, status, and internal timestamps. The protected Search page renders only selected fields, but the JSON API is neither protected nor serialized.
2. **Authorization gaps exist on direct reads:** authenticated users can open private-community detail pages without membership; search does not exclude private communities; listing detail does not require `ACTIVE`; question detail does not require `PUBLISHED`.
3. **The core content loops are read-heavy:** comments display but cannot be created; listings have a creation API but no enabled creation UI; posts, listings, questions, answers, messages, communities, profiles, and guides generally lack owner edit/delete flows.
4. **Trust labels exceed stored evidence:** member verification badges, “Trusted member,” “verified members,” “Reviewed by Kondo,” weekly-growth labels, weather, time, AQI, and the Home date are unconditional or hardcoded rather than driven by verified records or live services.
5. **Admin is a read-only overview:** role gating, aggregate queries, recent users, report summaries, and analytics bars exist; all operational workspaces/actions are disabled or missing.
6. **Explore Jiaxing is a polished typed editorial catalogue, not a live city platform:** one city, seven sections, 34 hardcoded entries, six external source links, no database, CMS, live dates, application, or partner workflow.
7. **Messaging is the most complete new transactional module:** direct-thread identity, text messages, unread state, notifications, block/report, rate limits, and duplicate protection work. Real time, uploads, archive UI, pagination, edit/delete, and moderation tooling do not.
8. **Operational controls remain MVP-level:** limits are in process, analytics are seeded rather than instrumented, expired sessions have no cleanup job, notifications are synchronous writes, and no observability integration exists.

## 3. System snapshot and module scorecard

| Area              | Current implementation                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Architecture      | Next.js App Router modular monolith                                                             |
| Rendering         | Static public pages; dynamic authenticated Server Components; client components for interaction |
| Backend           | Next.js route handlers in the same deployment                                                   |
| Database          | PostgreSQL through Prisma 5.22                                                                  |
| Identity          | Email/password, bcrypt cost 12, signed JWT cookie plus revocable database session               |
| UI                | React 19, Tailwind, Lucide, Radix Slot, Framer Motion, `next-themes`                            |
| Validation        | Zod at mutation boundaries                                                                      |
| Authorization     | Global roles plus community roles; server layouts/route handlers                                |
| Media             | Object-key columns only; no upload, signing, delivery, or rendering pipeline                    |
| Search            | Six PostgreSQL `contains` queries; protected page but public JSON endpoint                      |
| Deployment target | Vercel + managed PostgreSQL; object storage and Redis documented but not integrated             |
| Tests             | 17 unit tests; no integration, browser, E2E, accessibility, or database suite                   |

| Module                          | Purpose                                             | Status                  | Completion |
| ------------------------------- | --------------------------------------------------- | ----------------------- | ---------: |
| Application shell/navigation    | Responsive authenticated frame and global utilities | ✅ core / 🟡 indicators |        85% |
| Public marketing/policies       | Explain Kondo and provide draft product rules       | 🟡                      |        70% |
| Authentication/account identity | Register, sign in, validate sessions and roles      | 🟡                      |        68% |
| Onboarding/location             | Collect country, campus, study and interests        | 🟡                      |        60% |
| Home                            | Aggregate feed, guide, context, events, listings    | 🟡                      |        55% |
| Communities/posts/comments      | Group discovery and publishing                      | 🟡                      |        55% |
| Marketplace                     | Listing discovery, favorites, seller contact        | 🟡                      |        42% |
| Student Hub                     | Aggregate guides, Q&A, resources, events            | 🟡                      |        70% |
| Guides/checklists               | Instructions, progress and bookmarks                | 🟡                      |        68% |
| Help/Q&A                        | Questions, answers and helpful votes                | 🟡                      |        62% |
| Messages/blocking               | Private text conversations and safety controls      | 🟡                      |        65% |
| Profiles                        | Student identity, context and activity              | 🟡                      |        45% |
| Notifications                   | In-app list and bulk read state                     | 🟡                      |        40% |
| Search                          | Cross-module keyword discovery                      | 🟡, critical exposure   |        45% |
| Explore Jiaxing                 | Typed city guide and promotion content              | 🟡                      |        55% |
| Settings/language/theme         | Preferences and local theme state                   | ⚪ / 🟡 theme           |        30% |
| Admin/moderation/analytics      | Operations overview and trust foundations           | ⚪ / 🟡 read-only       |        25% |
| Media/asset delivery            | Provider-neutral media metadata                     | ⚪                      |        10% |

Arithmetic mean: **53%**.

### Feature-level status matrix

| Module            | ✅ Fully implemented                                                       | 🟡 Partially implemented                                             | ⚪ Placeholder                             | ❌ Missing                                                   |
| ----------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| Shell             | five-route desktop/mobile navigation; drawer; route transition             | notification indicator; theme choice limited to binary header toggle | keyboard-search hint                       | logout and global unread counts                              |
| Public            | page routing and CTAs                                                      | marketing/policy copy                                                | hardcoded app preview/metrics/testimonial  | content management and approved launch policies              |
| Auth              | register; login; Set-Cookie; session verification; logout API; roles gate  | audit coverage and origin/rate controls                              | OAuthAccount table                         | recovery; verification; MFA; session UI; logout UI           |
| Onboarding        | four-step submission and storage                                           | relevance/personalization context                                    | `studyYear` field                          | relational filtering/consistency; later editing              |
| Home              | aggregation and linked member actions                                      | feed personalization and events                                      | live-context cards and sort pills          | live weather/time/AQI and real event directory               |
| Communities       | directory; public join/leave; member post create; post reactions/bookmarks | private/community-role model; comment display                        | post images                                | community CRUD; comments write; owner/moderator tools        |
| Marketplace       | active reads; filters; favorites; seller messaging                         | listing create API and image metadata                                | sell button/secure uploads                 | enabled publishing, media, lifecycle, report, owner CRUD     |
| Student Hub       | aggregation links and source data display                                  | hardcoded curation                                                   | independent hub content architecture       | own persistence/admin/personalization                        |
| Guides            | published reads; search; bookmarks; step progress                          | category/filter and source coverage                                  | cover/action fields                        | editorial CRUD/review/versioning                             |
| Q&A               | question/answer create; reads; helpful vote                                | best-answer display; moderation status                               | accepted-answer field workflow             | edit/delete/report/set-best/admin                            |
| Messages          | first/reply text; canonical direct thread; unread/read; block/report       | bounded inbox/history and synchronous notifications                  | IMAGE/DOCUMENT metadata                    | realtime; uploads; archive UI; receipts; edit/delete         |
| Profiles          | own/public reads and contextual message                                    | activity slices/counts                                               | avatarKey and badges                       | profile edit/privacy/report/block/export/delete              |
| Notifications     | list and bulk-read                                                         | MESSAGE producer                                                     | other seeded notification types/header dot | preferences; individual state/delete; push/email/jobs        |
| Search            | six-domain keyword page                                                    | query quality/limits                                                 | future scalable search boundary            | safe public serialization; pagination/ranking/privacy filter |
| Explore           | generic city/section rendering and navigation                              | sourced/verified editorial coverage                                  | partner/jobs/events/profile statuses       | DB/API/CMS/live workflows/city selection                     |
| Settings/language | theme persistence                                                          | settings links                                                       | planned language cards                     | preference API, locale switching, System-selector UI         |
| Admin/trust       | role gate and read overview                                                | report/audit/analytics data foundations                              | disabled workspaces/actions                | operational CRUD/moderation/analytics instrumentation        |
| Media             | static OG asset                                                            | object-key and attachment columns                                    | documented storage contract                | upload, validation, delivery, rendering, deletion            |

## 4. Complete user-interface inventory

### Public and identity routes

| Route         | Screen            | Current user actions                                                                                | Current limitations                                                                                        |
| ------------- | ----------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/`           | Marketing landing | Use section anchors; sign in/register; open policy pages                                            | Preview, metrics, testimonial and dates are hardcoded; preview shows legacy Student guides/Help navigation |
| `/login`      | Sign in           | Email/password, show/hide password, submit, register link                                           | No recovery, OAuth or MFA                                                                                  |
| `/register`   | Registration      | Identity/password, accept Terms/Privacy, submit, login link                                         | No email verification, invite, social registration or username choice                                      |
| `/onboarding` | Four-step setup   | Country, city, university, program, level, arrival date, languages, interests; back/continue/finish | City/university lists are not filtered; no draft/resume or later edit                                      |
| `/about`      | About             | Return Home                                                                                         | Static source content                                                                                      |
| `/guidelines` | Guidelines        | Return Home                                                                                         | Describes reporting/moderation broader than current implementation                                         |
| `/privacy`    | Privacy overview  | Return Home                                                                                         | Explicitly pre-launch; no export/correction/deletion flows                                                 |
| `/terms`      | Terms overview    | Return Home                                                                                         | Explicitly draft MVP terms                                                                                 |
| `/dashboard`  | Legacy redirect   | Redirects to `/home`                                                                                | No screen                                                                                                  |

### Authenticated and admin routes

| Route                       | Screen and actions                                                                                        | Important limitations                                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `/home`                     | Create post; continue guide; react/bookmark/message/share/open comments; open events/communities/listings | Static date/time/weather/AQI; global feed; Relevant/Latest visual only; broken event View all semantics; Home Join only opens community |
| `/communities`              | Filter, open, join/leave                                                                                  | No search, pagination, create, invite or private policy UI                                                                              |
| `/communities/[slug]`       | Join/leave; create discussion/question if joined; feed actions; display selected-post comments            | Private reads not membership-gated; comments read-only; no owner/moderator CRUD                                                         |
| `/marketplace`              | Keyword/category filter; favorite; open detail                                                            | Sell disabled; no city/price/sort UI; no empty state; images not rendered                                                               |
| `/marketplace/[slug]`       | Favorite; message seller; back                                                                            | Emoji replaces images; status not checked; no edit/lifecycle/report/gallery                                                             |
| `/student-hub`              | Open six resources, guides, questions, events                                                             | Aggregation only; hardcoded resources; no own model/CRUD/personalization                                                                |
| `/guides`                   | Search/category/saved filters; open guide                                                                 | UI omits TRANSPORT/UNIVERSITY filters; no authoring/admin/pagination                                                                    |
| `/guides/[slug]`            | Bookmark; expand/toggle steps                                                                             | actionUrl and author unused; no versioning/edit/feedback                                                                                |
| `/help`                     | Search/filter; open question; Ask Question modal                                                          | Only earliest answer is fetched for preview; no empty state/pagination/moderation                                                       |
| `/help/[slug]`              | Message authors; answer; helpful vote                                                                     | Question status not filtered; no set-best/edit/delete/report/sort                                                                       |
| `/messages`                 | Search latest 50; open conversation                                                                       | No global recipient search, pagination, archive or realtime                                                                             |
| `/messages/new?recipient=`  | Send first text/emoji                                                                                     | Requires contextual ID; no attachment; thread created on send                                                                           |
| `/messages/[id]`            | Read latest 100; send; profile; block/unblock/report                                                      | No realtime, old-page load, edit/delete, attachments, receipts, archive                                                                 |
| `/notifications`            | Follow link; mark all read                                                                                | Click does not mark one read; no individual delete/preferences/delivery                                                                 |
| `/profile`                  | Open communities; view counts/recent posts                                                                | Read-only; Marketplace/Saved disabled; no edit/logout/export/delete                                                                     |
| `/profile/[username]`       | Open communities; message; recent posts                                                                   | Badge unconditional; no report/block/privacy/listing links                                                                              |
| `/search`                   | Search/open six content types                                                                             | No ranking/pagination/typos/highlights/city/messages; API exposure critical                                                             |
| `/settings`                 | Open Profile, Notifications, Language, Privacy                                                            | No editable settings, Appearance selector, security/session or logout                                                                   |
| `/language`                 | View English current and three planned languages                                                          | No selection, i18n or persistence                                                                                                       |
| `/explore/[city]`           | Open seven city sections/About                                                                            | Only Jiaxing; no switcher/profile city/live data/search/CMS                                                                             |
| `/explore/[city]/[section]` | Switch sections; read cards; open six external sources                                                    | No entry routes/CRUD/jobs/events/maps/verification workflow                                                                             |
| `/admin`                    | View counts, charts, recent reports/users                                                                 | Role-gated but read-only; all workspaces/actions disabled                                                                               |

### Dialogs, drawers, menus and popups

| Surface                     | Type and behavior                                          |
| --------------------------- | ---------------------------------------------------------- |
| Post Composer               | Modal: community/type/title/body; close, publish, refresh  |
| Ask Question                | Modal: category/title/context; publish redirects to detail |
| Answer Composer             | Inline expandable form with publish/cancel                 |
| Mobile navigation           | Left drawer with backdrop and five primary links           |
| Mobile quick navigation     | Fixed five-item bottom bar                                 |
| Explore menu                | Top-right dropdown; outside press/Escape/navigation closes |
| Emoji picker                | Popup with eight hardcoded emoji                           |
| Conversation options/report | Dropdown with block/unblock and expandable report form     |

There is no shared toast, confirmation dialog, custom error boundary, custom loading screen, or custom not-found page.

## 5. Detailed module audit

### 5.1 Application shell and navigation — 85%

✅ The responsive shell works for the five-destination contract. `AppShell`, internal `ThemeToggle`/`NavLink`, `KondoLogo`, `ExploreMenu`, and `Button` provide desktop sidebar, authenticated header, mobile drawer, fixed bottom navigation, and reduced-motion-aware route transitions.

Users can navigate, search, toggle light/dark, open notifications/profile/Explore, open/close the mobile drawer, and—when authorized—open Admin. Incomplete users see a profile-completion card. The notification dot is always visible, `⌘ K` is only a label, no logout action exists, and no message/notification counts are queried in the shell. All protected modules depend on this shell. It does not require a content CMS.

### 5.2 Public marketing and policies — 70%

🟡 `/`, About, Guidelines, Privacy, and Terms are complete static presentations using `InfoPage`, `KondoLogo`, and `Button`. There are no forms or stored records. Landing metrics/testimonial/app preview are mock content, the preview shows older navigation, and policy pages explicitly require formal pre-launch review.

A CMS is required if non-developers must manage landing claims and version/publish legal content. That would require editorial CRUD plus restricted legal publication. Nothing exists today.

### 5.3 Authentication and account identity — 68%

🟡 Registration, login, active-user validation, and logout API are implemented. Login fields are email/password. Registration fields are names, email, password/confirmation, and required acceptance. Validation normalizes email; passwords use bcrypt cost 12; login has 8 attempts/10 minutes/IP, registration 5/hour/IP; success creates a database session and audit record and redirects Home/Onboarding.

Session details: cookie `kondo_session`; HS256 JWT with user ID, email, role and random session ID; seven-day expiry; SHA-256 of the random ID in PostgreSQL. Cookie is host-only, HttpOnly, SameSite=Lax, Path=/; Secure is false in development and true only for effective production HTTPS. Logout deletes the matching DB session and clears the cookie with matching scope, epoch expiry, and Max-Age=0. No middleware exists; layouts/handlers enforce auth.

Missing: logout UI, email verification despite the field, reset/change password, OAuth despite its model, MFA, username setup, device/session list, revoke-all, suspicious-login alerts, expired-session cleanup. Limits are per process; missing forwarded IP becomes one `unknown` bucket. Origin checks accept missing Origin. Roles are MEMBER/MODERATOR/ADMIN/SUPER_ADMIN; community roles are separate; no role/admin lifecycle exists.

### 5.4 Onboarding and location — 60%

🟡 `OnboardingFlow` plus `OptionGrid`, `SelectField`, `InputField` collects normalized IDs, program, study level, arrival date, 1–8 languages, and at least one fixed interest. It protects the route, redirects completed users, writes User and AuditLog.

Country does not filter city, city does not filter university, and the API does not validate referenced-row existence before update or relational consistency. No draft/resume, later edit, or `studyYear` collection exists. The seed includes a Shanghai/Peking University mismatch. Reference-data CMS/admin CRUD and verification are entirely absent.

### 5.5 Home — 55%

🟡 Home aggregates posts, six communities, four listings, guides, and three future event posts. Working components/actions are `PostComposer`, `FeedPost`, `ListingCard`, `Avatar`, bookmarks/reactions/messages and links.

The “For you” query is the latest eight global published non-event posts, not joined communities. Relevant/Latest is decorative. Date, local time, weather, AQI and Beijing fallback are static. `/communities?type=events` matches no CommunityType. Share copies the current page URL rather than a post permalink. Suggested Join only opens detail. Home has no independent CMS; it inherits source-module management needs.

### 5.6 Communities, posts, comments and reactions — 55%

🟡 Directory filtering, public join/leave, member-only post creation, pinned display, helpful post reactions, bookmarks, messaging and comment reads work through `CommunityCard`, `CommunityJoinButton`, `PostComposer`, and `FeedPost`. UI creates Discussion/Question; API additionally accepts Event but UI sends no event fields.

Missing: community CRUD/invites/ownership/member roles; post edit/delete/pin/moderation; comment create/edit/delete/reply/reaction; event editor; media and pagination. Private-community detail is readable without membership; authenticated directory queries include private records; public Search includes them. Reaction can reference post/comment but exactly one target is not enforced and only post endpoints exist.

CRUD: Community C❌ R✅ U❌ D❌; Membership C/R/D✅ and role U❌; Post C/R✅ U/D❌; Comment R✅ only; Post Reaction C/R/D✅; Comment Reaction ❌. A full community/content CMS and moderation interface is required and missing.

### 5.7 Marketplace — 42%

🟡 Active listing discovery, keyword/category filtering, favorites, detail and seller messaging work through `ListingCard`, `ListingFavoriteButton`, and `MessageUserButton`. A validated create API accepts category/city, title, description, integer fen, negotiable flag, and 1–8 image keys. Kondo stores no payment/transaction data.

The sell button is disabled. There is no secure upload, image rendering, create form, edit/delete, draft/reserve/sold/archive/expiry, owner dashboard, report, gallery, city/price/sort UI, or transaction workflow. Detail does not filter status. Category counts include every status. Favorite does not require active status. Trust labels are unconditional. The API trusts arbitrary object keys.

CRUD: Category R✅ only; Listing C🟡 API-only/R✅/U❌/D❌; Image C🟡 metadata/R🟡 not rendered/U/D❌; Favorite C/R/D✅. Marketplace CMS/trust operations are missing.

### 5.8 Student Hub — 70%

🟡 Student Hub successfully composes existing Guides, Q&A and Event posts without duplicating them. Six hardcoded resource cards, three guides, four questions and three future events link to source routes.

It has no own model/API/CRUD, personalization, saved overview, search, or editable resource ordering. A CMS is needed only for hub curation; source content management belongs to Guides, Q&A and Communities.

### 5.9 Guides and checklists — 68%

🟡 `GuideCard`, `GuideChecklist`, and `BookmarkButton` provide search/filter, saved view, published detail, expandable steps, persisted progress and bookmarks.

Missing: author/admin CRUD, draft/review/publish, versioning/localization/variants, feedback/sources/review reminders. `actionUrl` and `coverImageKey` are unused; author is queried but not displayed; TRANSPORT/UNIVERSITY filters are omitted. Progress writes do not check that the step belongs to a published guide.

Guide/Step CRUD is Read only; Progress and Bookmark C/R/D are operational. A complete editorial CMS is required and missing.

### 5.10 Help center / Q&A — 62%

🟡 `QuestionComposer`, `AnswerComposer`, `HelpfulButton`, and messaging allow question/answer creation, reading, filtering/search, helpful voting, and stored best-answer display.

Missing: edit/delete/report/moderation/sorting/duplicates and best-answer mutation. Best answers currently require seed/manual data. Directory retrieves one earliest answer, so another selected best answer cannot be previewed. Detail does not filter Question status.

CRUD: Question C/R✅ U/D❌; Answer C/R✅ U/D❌; Vote C/R/U/D✅; best-answer Read only. CMS/moderation is missing.

### 5.11 Messages and blocking — 65%

🟡 The direct text MVP works through `MessageUserButton`, `MessageComposer`, `MarkConversationRead`, and `ConversationActions`. Entry exists from profiles, posts, comments, listings, questions, and answers; the sorted pair key prevents duplicate direct histories; the first message creates the thread; text is limited to 2,000; inbox is latest 50, conversation latest 100; unread/read state, synchronous notification, bidirectional block prevention, report creation/reuse and audit work.

Limits: 30 sends/minute, 8 new recipients/hour, duplicate identical body within 10 seconds rejected, 20 blocks/day, 5 reports/day—all limits except duplicate detection are in process.

Missing: realtime/polling, receipts, typing, presence, upload, older pagination, archive UI, edit/delete, per-message report, groups, push/email, retention/deletion and moderator evidence. Inbox performs one unread-count query per thread. DB does not enforce exactly two DIRECT participants.

CRUD: Conversation C/R✅ U🟡 timestamps D❌; Message C/R✅ U/D❌; Block C/R/D✅; Report C/R-summary✅ U/D❌. Messages do not need normal CMS, but restricted safety administration is missing.

### 5.12 Profiles — 45%

🟡 Own/member profiles show identity, location/study/languages, counts, recent communities/posts and a Message action. They are read-only. Marketplace/Saved tabs are disabled; no avatar/bio/context edit, privacy, report/block, export/delete, listing display, pagination, or settings action exists. `Avatar` ignores `avatarKey`. Verification badge is unconditional and User has no member-verification field. Counts include all posts/listings while visible posts are published only.

Profile CRUD: creation through register/onboarding, Read✅, Update🟡 onboarding only, Delete❌. User self-service and restricted admin management are missing.

### 5.13 Notifications — 40%

🟡 Latest 50 records, actor/system icon, unread style, href and bulk read work. Message sends create `MESSAGE` synchronously; other displayed types are primarily seed examples.

Missing: source events for most categories, individual read/delete, click-to-read, preferences/digest/push/email, jobs/templates/deduplication/pagination. The header dot is static. CRUD: Create🟡 messaging/seed, Read✅, Update🟡 bulk, Delete❌.

### 5.14 Search — 45%

🟡 Case-insensitive contains queries cover communities, active listings, published guides/questions/posts and active users, six per domain. API validates 2–100 chars and limits 60/minute/IP/process.

**Critical:** public `/api/search` returns full User rows in both `users` and `posts[].author`, including password hashes and other internal fields. It also fails to exclude private communities. The page is protected but calls the query directly without API max length/rate limit. No ranking, indexes, typo handling, highlight, facets, pagination, analytics, city content or messages exist. Search needs operational configuration, not a content CMS.

### 5.15 Explore Jiaxing — 55%

🟡 Generic `ExploreCity`/Section/Entry contracts, registry and `CityHubView`/`CitySectionView`/`ExploreIcon` render one registered city. Content: 5 companies, 5 products, 3 universities, 5 opportunities, 5 events, 6 services, 5 stories. Six entries have official external links. Many statuses explicitly say future profile/directory or verification required.

Missing: DB/API/CMS, entry routes, city switcher/profile selection, search/save/share, applications/RSVP/maps/live services, partner submission, moderation/expiry/history/source governance. Jiaxing is absent from seeded City/University. All CRUD requires code deployment. A full reviewed city-content CMS is required.

### 5.16 Settings, language and theme — 30%

⚪ Settings links to Profile, Notifications, Language and Privacy. Language only marks English Current and French/Chinese/Arabic Planned. 🟡 Header theme toggles light/dark; root defaults System and `next-themes` persists locally.

There is no settings model/API, System selector UI, notification/privacy/session control, logout, locale selection, translation resource or persistence. Localization governance and preference self-service are missing.

### 5.17 Admin, moderation, audit and analytics — 25%

🟡 MODERATOR/ADMIN/SUPER_ADMIN can see active users, all communities, active listings, published guides, open/reviewing reports, five recent users/reports, and grouped analytics bars. Selected mutations write AuditLog; conversation reports create cases.

“↑ this week” is hardcoded. “Last seven days” aggregates all time. Runtime features never create AnalyticsEvent; seed does. Report list is latest regardless status. All non-Overview tabs/buttons are disabled. No user/role/status/session, content, report lifecycle, listing, guide, audit, analytics, city or media operation exists. This is the missing administration layer.

### 5.18 Media and asset delivery — 10%

⚪ Existing fields are avatar/cover/post/listing object keys and message attachment metadata; storage variables are documented; `public/og.png` is the only public image.

No upload/signing, ownership, MIME/size/dimension/decoding/malware checks, storage client, CDN serializer, deletion/lifecycle/moderation, or application image rendering exists. Media is a prospective dependency of Profiles, Posts, Marketplace, Guides and Messages.

## 6. Complete component catalogue

Route page components are listed in the UI inventory. These are all named non-route React components and local component helpers found in source.

| Component               | Purpose                                               | Used by                                          |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| `KondoLogo`             | CSS-native mark/wordmark with optional link and size  | Landing, auth, onboarding, InfoPage, AppShell    |
| `AppShell`              | Sidebar, header, drawer, bottom nav, route transition | Platform/admin layouts                           |
| `ThemeToggle`           | Internal light/dark toggle                            | AppShell header                                  |
| `NavLink`               | Internal active-aware navigation link                 | AppShell sidebar/drawer                          |
| `ExploreMenu`           | City/settings/language dropdown                       | AppShell                                         |
| `CityHubView`           | Generic city overview, section cards and impact       | Explore city route                               |
| `CitySectionView`       | Generic section/entry cards and section switcher      | Explore section route                            |
| `ExploreIcon`           | Typed icon/accent mapper                              | Explore views                                    |
| `CommunityCard`         | Counts, latest activity and join state                | Communities directory                            |
| `CommunityJoinButton`   | Optimistic join/leave                                 | Community card/detail                            |
| `PostComposer`          | Post modal and submission                             | Home/community detail                            |
| `FeedPost`              | Post content and engagement actions                   | Home/community detail                            |
| `ListingCard`           | Emoji listing and optimistic favorite                 | Home/Marketplace                                 |
| `ListingFavoriteButton` | Detail favorite toggle                                | Listing detail                                   |
| `GuideCard`             | Guide summary/progress                                | Guides/Student Hub                               |
| `GuideChecklist`        | Expandable persisted checklist                        | Guide detail                                     |
| `QuestionComposer`      | Ask-question modal                                    | Help directory                                   |
| `AnswerComposer`        | Expandable answer form                                | Question detail                                  |
| `HelpfulButton`         | Optimistic answer vote                                | Question detail                                  |
| `BookmarkButton`        | Generic bookmark GET/PUT/DELETE                       | Posts/guides; not mounted for listings/questions |
| `MessageUserButton`     | Contextual first-message link, hidden for self        | Profiles, posts, comments, listings, Q&A         |
| `MessageComposer`       | Text/emoji first/reply form                           | New message/conversation                         |
| `MarkConversationRead`  | Client read-timestamp effect                          | Conversation detail                              |
| `ConversationActions`   | Block/unblock/report popup                            | Conversation detail                              |
| `MarkAllReadButton`     | Bulk notification read                                | Notifications                                    |
| `OnboardingFlow`        | Four-step state and submission                        | Onboarding                                       |
| `OptionGrid`            | Internal country grid                                 | OnboardingFlow                                   |
| `SelectField`           | Internal city/university select                       | OnboardingFlow                                   |
| `InputField`            | Internal onboarding text field                        | OnboardingFlow                                   |
| `InfoPage`              | Shared public policy/editorial layout                 | About/Guidelines/Privacy/Terms                   |
| `ThemeProvider`         | `next-themes` wrapper                                 | Root layout                                      |
| `Avatar`                | Initials and deterministic gradient                   | Shell/social/admin screens                       |
| `Button`                | CVA/Radix composable primitive                        | Product-wide                                     |
| `Card`                  | Shared surface primitive                              | Product-wide                                     |
| `PageHeader`            | Title/eyebrow/description/action                      | Directories/settings/admin                       |
| `ResultCard`            | Internal generic search result                        | Search page                                      |
| `Field`                 | Internal registration input                           | Register page                                    |

No duplicate second Button/Card/Avatar design system was found.

## 7. Database audit

### 7.1 Platform and migrations

Canonical schema: `prisma/schema.prisma`. Provider: PostgreSQL. IDs default to CUID unless a composite key is stated. The schema has **30 models**, **18 enums**, two migrations, and no `migration_lock.toml` in source.

| Migration                             | Contents                                                                                                                                                   | Character                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `20260715060000_kondo_community_mvp`  | 16 enums, 26 tables, baseline indexes and 44 foreign keys for identity, location, community, marketplace, knowledge, notifications, trust, OAuth, sessions | Initial schema              |
| `20260715190000_student_hub_messages` | 2 enums, Conversation/Participant/Message/UserBlock, 7 indexes and 6 FKs                                                                                   | Additive messaging/blocking |

### 7.2 Every enum

| Enum                 | Values                                                                                                                                                  | Current use                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `Role`               | MEMBER, MODERATOR, ADMIN, SUPER_ADMIN                                                                                                                   | Global authorization                       |
| `UserStatus`         | ACTIVE, SUSPENDED, DEACTIVATED                                                                                                                          | Authentication/search/profile availability |
| `StudyLevel`         | LANGUAGE, BACHELORS, MASTERS, DOCTORATE, EXCHANGE, OTHER                                                                                                | Onboarding/profile                         |
| `CommunityType`      | UNIVERSITY, COUNTRY, CITY, TOPIC                                                                                                                        | Directory classification                   |
| `MembershipRole`     | MEMBER, MODERATOR, OWNER                                                                                                                                | Community membership                       |
| `PostType`           | DISCUSSION, QUESTION, EVENT, ANNOUNCEMENT                                                                                                               | Feeds/events; UI creates first two         |
| `ContentStatus`      | PUBLISHED, PENDING_REVIEW, REMOVED                                                                                                                      | Content moderation state                   |
| `ReactionType`       | LIKE, HELPFUL, CELEBRATE                                                                                                                                | Seed supports all; UI uses HELPFUL         |
| `ListingStatus`      | DRAFT, ACTIVE, RESERVED, SOLD, ARCHIVED, REMOVED                                                                                                        | Listing lifecycle schema                   |
| `GuideCategory`      | BEFORE_DEPARTURE, ARRIVAL, RESIDENCY, DAILY_LIFE, MONEY, TRANSPORT, HEALTH, UNIVERSITY                                                                  | Guides                                     |
| `HelpCategory`       | VISA, HOUSING, BANK, UNIVERSITY, SCHOLARSHIP, TRAVEL, HEALTH                                                                                            | Q&A                                        |
| `NotificationType`   | MESSAGE, COMMENT, REPLY, MARKETPLACE_UPDATE, COMMUNITY_ANNOUNCEMENT                                                                                     | Message runtime/seed examples              |
| `ConversationType`   | DIRECT                                                                                                                                                  | Direct messages                            |
| `MessageType`        | TEXT, IMAGE, DOCUMENT                                                                                                                                   | TEXT runtime; others placeholder           |
| `BookmarkTargetType` | POST, LISTING, GUIDE, QUESTION                                                                                                                          | Polymorphic bookmarks                      |
| `ReportStatus`       | OPEN, REVIEWING, RESOLVED, DISMISSED                                                                                                                    | Moderation case state                      |
| `ReportReason`       | SPAM, HARASSMENT, SCAM, INAPPROPRIATE, OTHER                                                                                                            | Reports                                    |
| `AnalyticsEventName` | SESSION_STARTED, COMMUNITY_VIEWED, POST_CREATED, POST_REACTED, LISTING_VIEWED, LISTING_CONTACTED, GUIDE_STARTED, GUIDE_STEP_COMPLETED, SEARCH_PERFORMED | Schema/seed only                           |

### 7.3 Every model/table, relation and index group

| Model                     | Principal fields and use                                                                                         | Relations/delete behavior                                                | Uniqueness and indexes                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `User`                    | email/hash/names/username/avatar/bio/phone; role/status; location/study/languages/interests; onboarding/activity | optional Country/City/University SetNull; parent of owned/member records | unique email/username; indexes country, city, university, status+lastActiveAt |
| `Country`                 | code/name/emoji reference                                                                                        | users/cities/universities/communities                                    | unique code/name                                                              |
| `City`                    | slug/name/province/country                                                                                       | Country Restrict; users/universities/communities/listings                | unique slug and country+name; country index                                   |
| `University`              | slug/name/shortName/country/city/verified                                                                        | Country/City Restrict; users/communities                                 | unique slug and city+name; country/city indexes                               |
| `Community`               | slug/name/description/type/icon/cover/verified/private/creator/location                                          | creator Restrict; location SetNull; members/posts                        | unique slug; type+private, locations, createdAt indexes                       |
| `CommunityMember`         | community/user/role/joined                                                                                       | Community/User Cascade                                                   | unique community+user; user index                                             |
| `Post`                    | community/author/type/status/title/content/images/event/pin/edit                                                 | Community/User Cascade; comments/reactions                               | community+status+time; author+time; type+event; pinned                        |
| `Comment`                 | post/author/parent/content/status/edit                                                                           | Post/User Cascade; parent Cascade; reactions                             | post+status+time; author; parent                                              |
| `Reaction`                | type/user/optional post/comment                                                                                  | all target/user relations Cascade                                        | unique user+post+type and user+comment+type; target indexes                   |
| `MarketplaceCategory`     | slug/name/icon/order                                                                                             | listings                                                                 | unique slug/name                                                              |
| `MarketplaceListing`      | slug/seller/category/city/title/description/price/negotiable/status/publish/expiry                               | seller Cascade; category/city Restrict; images/favorites                 | unique slug; status+time, category/status, city/status, seller/status, price  |
| `ListingImage`            | listing/objectKey/alt/dimensions/order                                                                           | Listing Cascade                                                          | listing+order                                                                 |
| `ListingFavorite`         | listing/user/time                                                                                                | Listing/User Cascade                                                     | unique listing+user; user+time                                                |
| `Guide`                   | slug/title/summary/category/cover/minutes/published/featured/creator                                             | creator Restrict; steps                                                  | unique slug; published+category; featured+publishedAt                         |
| `GuideStep`               | guide/order/title/content/actionUrl                                                                              | Guide Cascade; progress                                                  | unique guide+order                                                            |
| `GuideProgress`           | user/step/completedAt                                                                                            | User/Step Cascade                                                        | unique user+step; user+completedAt                                            |
| `Question`                | slug/author/category/title/body/status/bestAnswerId                                                              | Author Cascade; answers; bestAnswer is soft                              | unique slug; category+status+time; author                                     |
| `Answer`                  | question/author/body/status                                                                                      | Question/User Cascade; votes                                             | question+status+time; author                                                  |
| `AnswerVote`              | answer/user/helpful/time                                                                                         | Answer/User Cascade                                                      | unique answer+user; user                                                      |
| `Bookmark`                | user/targetType/targetId/time                                                                                    | User Cascade; target has no FK                                           | unique user+type+target; target type+id                                       |
| `Notification`            | recipient/actor/type/title/body/href/readAt                                                                      | recipient Cascade; actor SetNull                                         | recipient+read+time; actor                                                    |
| `Conversation`            | type/directKey/lastMessageAt                                                                                     | participants/messages                                                    | unique optional directKey; lastMessageAt                                      |
| `ConversationParticipant` | conversation/user/joined/read/archive                                                                            | Conversation/User Cascade                                                | composite PK; user+conversation; user+read                                    |
| `Message`                 | conversation/sender/type/body/attachment/edit/time                                                               | Conversation/User Cascade                                                | conversation+time; sender+time                                                |
| `UserBlock`               | blocker/blocked/time                                                                                             | both User Cascade                                                        | composite PK; blocked lookup                                                  |
| `Report`                  | reporter/assignee/string target/reason/status/details/resolution                                                 | reporter Cascade; assignee SetNull; target no FK                         | status+time; target; assignee                                                 |
| `AuditLog`                | actor/action/entity/old-new JSON/IP/user-agent                                                                   | actor SetNull; entity no FK                                              | actor; entity; createdAt                                                      |
| `AnalyticsEvent`          | user/name/properties/session/time                                                                                | user SetNull                                                             | name+time; user+time; session                                                 |
| `OAuthAccount`            | user/provider/account/tokens/expiry/scope                                                                        | User Cascade                                                             | unique provider+providerAccount; user                                         |
| `Session`                 | tokenHash/user/expiry/IP/user-agent                                                                              | User Cascade                                                             | unique hash; user+expiry; expiry                                              |

Integrity limitations: Reaction does not enforce exactly one target; Question.bestAnswerId, Bookmark/Report/Audit entity targets are soft; DIRECT does not enforce two participants; Message permits neither body nor attachment at DB level; onboarding relationships are not cross-validated; price/string bounds are largely application-only; no account deletion/retention workflow exists.

## 8. Complete API inventory

Mutation routes use a database session and trusted-origin host where stated. Normal error bodies are `{ error: string }`. Some ID-only mutations can still throw raw Prisma errors for invalid foreign keys.

| Method and endpoint                     | Auth/validation                             | Purpose and success response                                | Status                     |
| --------------------------------------- | ------------------------------------------- | ----------------------------------------------------------- | -------------------------- |
| `POST /api/auth/register`               | Public; origin; 5/hour/IP; schema           | Create MEMBER/session/audit/cookie; `201 {user}`            | ✅                         |
| `POST /api/auth/login`                  | Public; origin; 8/10min/IP; schema          | Verify active, session/audit/cookie; `200 {user}`           | ✅                         |
| `POST /api/auth/logout`                 | Origin; token optional                      | Revoke and clear; `{ok:true}`                               | ✅ API / ❌ UI             |
| `GET /api/auth/me`                      | Session                                     | safe `{user}` or `401 {user:null}`                          | ✅                         |
| `PUT /api/onboarding`                   | Session/origin/schema                       | User update/audit; `{ok:true}`                              | 🟡 relation checks         |
| `GET /api/communities`                  | Public                                      | non-private directory/counts, cache 60/300; `{communities}` | ✅                         |
| `POST /api/communities/:id/members`     | Session/origin/public                       | idempotent join; `201 {membership}`                         | ✅                         |
| `DELETE /api/communities/:id/members`   | Session/origin/not Owner                    | idempotent leave; `204`                                     | ✅                         |
| `POST /api/posts`                       | Session/member/origin; 12/hour; schema      | create/audit; `201 {post}`                                  | ✅ limited UI              |
| `POST /api/posts/:id/reactions`         | Session/origin/enum                         | upsert; `201 {reaction}`                                    | 🟡 target pre-check absent |
| `DELETE /api/posts/:id/reactions`       | Session/origin/enum                         | delete own; `204`                                           | ✅                         |
| `GET /api/marketplace`                  | Public; category/city                       | latest 50 active, cache 30/120; `{listings}`                | ✅                         |
| `POST /api/marketplace`                 | Session/origin; 10/day; schema              | Active listing/image keys/audit; `201 {listing}`            | 🟡 API-only/media unsafe   |
| `POST /api/marketplace/:id/favorites`   | Session/origin                              | upsert; `201 {favorite}`                                    | 🟡 no active check         |
| `DELETE /api/marketplace/:id/favorites` | Session/origin                              | delete; `204`                                               | ✅                         |
| `PUT /api/guides/progress/:stepId`      | Session/origin                              | upsert completion; `{progress}`                             | 🟡 no published check      |
| `DELETE /api/guides/progress/:stepId`   | Session/origin                              | remove; `204`                                               | ✅                         |
| `POST /api/questions`                   | Session/origin; 8/hour; schema              | create/audit; `201 {question}`                              | ✅                         |
| `POST /api/questions/:id/answers`       | Session/origin; 20/hour; published question | create/audit; `201 {answer}`                                | ✅                         |
| `PUT /api/answers/:id/votes`            | Session/origin                              | upsert helpful; `{vote}`                                    | 🟡 no status check         |
| `DELETE /api/answers/:id/votes`         | Session/origin                              | delete; `204`                                               | ✅                         |
| `GET /api/bookmarks/:type/:id`          | Session/valid enum                          | `{bookmarked}`                                              | ✅                         |
| `PUT /api/bookmarks/:type/:id`          | Session/origin/publishable target           | upsert; `201 {bookmark}`                                    | ✅                         |
| `DELETE /api/bookmarks/:type/:id`       | Session/origin/enum                         | delete; `204`                                               | ✅                         |
| `PATCH /api/notifications/read-all`     | Session/origin                              | update unread; `{updated}`                                  | ✅                         |
| `GET /api/search?q=`                    | **Public**; 60/min/IP; 2–100                | six raw arrays; private cache 15s                           | 🟡 **critical exposure**   |
| `POST /api/messages`                    | Session/origin/message limits/schema        | first direct message; `200/201 {conversationId,message}`    | ✅ text                    |
| `POST /api/conversations/:id/messages`  | Session participant/origin/30min            | reply/notify; `201 {conversationId,message}`                | ✅ text                    |
| `PATCH /api/conversations/:id/read`     | Session participant/origin                  | read timestamp; `{success:true}`                            | ✅                         |
| `POST /api/conversations/:id/report`    | Session participant/origin/5day/schema      | reuse/create; `200/201 {reportId}`                          | ✅ create-only             |
| `POST /api/users/:id/block`             | Session/origin/20day/not self               | block/audit; `{blocked:true}`                               | ✅                         |
| `DELETE /api/users/:id/block`           | Session/origin/not self                     | unblock/audit; `{blocked:false}`                            | ✅                         |

No endpoints exist for community CRUD, comments, post update/delete, listing lifecycle, guide CRUD, best answers, profile editing, individual notifications, settings/language, Explore, admin operations, runtime analytics, audit reads, uploads, or OAuth.

## 9. Forms audit

| Form                    | Fields and validation                                                                     | Submission/storage                          | Missing behavior                             |
| ----------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------- |
| Login                   | email; password 1–200                                                                     | JSON login; session/cookie; Home/Onboarding | recovery/MFA/OAuth                           |
| Registration            | names 2–60; email; strong 10+ password; confirmation; terms=true                          | User/session/audit; onboarding              | verification, username, consent version/time |
| Onboarding              | country/city/university CUID; degree 2–120; level; date; 1–8 languages; ≥1 fixed interest | PUT User/audit                              | relational consistency, draft/edit           |
| Post Composer           | community; Discussion/Question; title ≤180; content 3–10,000                              | POST Post/audit                             | Event fields, images, draft/edit             |
| Marketplace directory   | q and hidden category                                                                     | URL query/in-memory filter                  | city/price/sort/pagination                   |
| Listing create contract | category/city/title/description/price/negotiable/1–8 keys                                 | API creates Active listing/images           | no form or secure upload                     |
| Guide directory         | q, category and saved links                                                               | URL query/server fetch/in-memory filter     | complete categories/pagination               |
| Help directory          | q and category                                                                            | URL query/in-memory filter                  | pagination/zero state                        |
| Ask Question            | category; title 8–180; body 20–10,000                                                     | Question/audit/redirect                     | draft/edit/media/duplicate warning           |
| Answer                  | body 10–10,000                                                                            | Answer/audit/refresh                        | edit/delete/source/report                    |
| Global Search           | q; page min 2, API 2–100                                                                  | direct server query/public API              | serialization/auth/ranking/pagination        |
| Inbox search            | q                                                                                         | filters latest 50 in memory                 | full-history search                          |
| Message Composer        | text 1–2,000; eight emoji                                                                 | first/reply Message/Notification            | attachments/realtime/drafts                  |
| Conversation report     | reason; details ≤1,000 optional                                                           | Report/AuditLog                             | evidence/status tracking                     |

## 10. Navigation and route protection

Primary navigation is identical in desktop sidebar, mobile drawer and mobile bottom bar: Home, Communities, Marketplace, Student Hub, Messages. `/guides` and `/help` are aliases that activate Student Hub. Admin appears only to MODERATOR, ADMIN, SUPER_ADMIN.

Top navigation contains mobile hamburger, a link styled as “Search Kondo,” light/dark toggle, notifications with unconditional dot, profile initials, and Explore menu. The Explore menu links Explore Jiaxing, City Events, Settings and Language.

Hidden/stable routes: `/guides` and `/help` remain functional without primary entries; `/messages/new` is contextual; dynamic details come from cards/search; `/dashboard` redirects; `/admin` is conditional.

All `app/(platform)` pages call `requireUser` through the dynamic shared layout. Onboarding independently requires a user. Admin additionally checks `canAccessAdmin`. There is no middleware/proxy. Public JSON endpoints are Communities, Marketplace and Search; Search exposes internal fields.

## 11. Authentication, roles and permissions

Login/registration behavior and cookie mechanics are detailed in module 5.3. The current permission layers are:

- global User role: MEMBER, MODERATOR, ADMIN, SUPER_ADMIN;
- User status: only ACTIVE can authenticate/be returned by current-user lookup;
- community membership role: MEMBER, MODERATOR, OWNER;
- admin access: MODERATOR, ADMIN, SUPER_ADMIN;
- post creation: any community member;
- community leave: any non-owner member;
- conversation read/reply/report: participant only;
- block: authenticated user, not self;
- generic helper `canManageResource`: owner or moderator, but no owner CRUD currently consumes it.

Permissions are not configurable. There is no role assignment, suspension, content removal, ownership transfer, invitation, or moderator action UI/API. JWT role is present, but the user returned for application authorization is re-read from the database.

The LAN/localhost/Vercel cookie behavior is compatible by design. Cookies are host-only, so a login at `localhost` and one at a LAN IP are separate browser-origin sessions; they are not shared across hostnames.

## 12. Reusable systems

| System                 | Reusability             | Consumers                                                  | Limitation                                   |
| ---------------------- | ----------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| Authentication/session | High                    | Every protected route/API                                  | incomplete lifecycle; in-process limits      |
| Authorization helpers  | Medium                  | Admin; future owner CRUD                                   | gaps on private/status reads                 |
| Zod validation         | High                    | Current mutation payloads                                  | some relational/publishability checks absent |
| Audit logging          | High                    | Auth/onboarding/membership/posts/listings/Q&A/block/report | partial coverage; no viewer                  |
| Rate limit             | Medium single-instance  | Auth/content/search/messages/safety                        | no shared store/cleanup/headers              |
| Posts/feed             | Medium                  | Home/community/profile/search/events                       | no comment write/media/CRUD                  |
| Bookmark engine        | High                    | Posts/guides                                               | listing uses Favorite; question UI unused    |
| Messaging engine       | High                    | Profiles/community/market/Q&A                              | text-only/no realtime/admin evidence         |
| Notifications          | Medium                  | Messages/seed                                              | no event bus/templates/preferences/worker    |
| Search                 | Medium boundary         | page/API                                                   | critical serialization; no scalable index    |
| City registry          | High presentation reuse | Explore routes                                             | code content; one city                       |
| Media metadata         | Low                     | prospective cross-module                                   | no actual engine                             |
| Presentation helpers   | High                    | dates/prices/initials/gradients                            | English/local assumptions                    |
| UI primitives          | High                    | product-wide                                               | no toast/dialog primitive                    |

## 13. Module dependency map

| Module              | Depends on                                                          | Depended on by                                             |
| ------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| Identity/Auth       | User, Session, AuditLog, JWT/cookies, Prisma                        | every protected module                                     |
| Onboarding/Location | Auth, Country, City, University, User                               | Home, Community context, Marketplace, Profiles, Search     |
| AppShell            | Auth user, theme, navigation                                        | all platform/admin pages                                   |
| Home                | Communities/Posts, Guides, Marketplace, Events, Profile             | aggregation endpoint only                                  |
| Communities/Posts   | Users, location, membership, reactions/bookmarks                    | Home, Student Hub events, Profiles, Search, Messages entry |
| Marketplace         | User, City, Category, media metadata, favorites, messaging          | Home, Search, Profile counts, Admin                        |
| Student Hub         | Guides, Q&A, Event posts                                            | primary navigation/engagement                              |
| Guides              | User, Step/Progress, Bookmark                                       | Home, Student Hub, Search, Admin                           |
| Q&A                 | User, status, votes, messaging                                      | Student Hub, Search                                        |
| Messaging           | Auth/User, Conversation/Message, Block, Notification, Report, Audit | contextual actions across modules                          |
| Profiles            | User, Location, Communities, Posts, Listings                        | Messaging, Search                                          |
| Notifications       | User and producers (currently Messaging)                            | Header/page                                                |
| Search              | Communities, Listings, Guides, Questions, Users, Posts              | Header/page/API                                            |
| Explore             | typed local registry, shell                                         | Explore menu only; disconnected from DB                    |
| Admin               | Auth/roles and operational tables                                   | no downstream module                                       |
| Media               | future storage and ownership                                        | Profiles, Posts, Marketplace, Guides, Messages             |

Critical coupling facts: Student Hub is composition, not a backend; Explore is disconnected from normalized City/University; Notification schema is broader than producers; Admin reads domains directly via Prisma; Search reads six domains directly and causes the current privacy exposure.

## 14. Mock, hardcoded, placeholder and development-only inventory

### Seed/demo data

- Seed deletes every table before recreation and is unsafe for production.
- Shared demo password: `ChangeMe123!`.
- 8 countries; 4 cities (Beijing, Shanghai, Wuhan, Hangzhou); 4 universities; no Jiaxing data.
- 6 users: one SUPER_ADMIN, one MODERATOR, four MEMBER.
- 6 communities, 19 memberships, 6 posts (3 events), 3 comments, 6 reactions.
- 8 categories, 4 active listings, 4 fake image keys, 1 favorite.
- 4 guides, 13 steps, first 3 complete for Ama.
- 2 questions, 2 answers, 2 votes, one seed-set best answer.
- 4 notifications, one direct conversation/two messages.
- one REVIEWING listing-scam report and one seed audit entry.
- 63 synthetic analytics rows across six event names.
- Events are fixed to July 18/22/27, 2026 and will become stale.
- One user combines Shanghai city with Peking University in Beijing.

### Hardcoded UI/content

- Home date/time/weather/AQI/fallback city and Relevant/Latest visuals.
- Landing metrics, testimonial, flags, product mock and legacy nav labels.
- Student Hub resource cards; Language cards; Admin arrows/seven-day label.
- Member badges/trusted labels; eight emoji shortcuts.
- All 34 Explore entries/statuses.

### Placeholder services/data

- Demo listing object keys have no rendered storage assets.
- avatar/cover/post/message media, OAuth, storage variables and Redis are contracts only.
- No weather, AQI, map, transport, mail, push, runtime analytics, CMS, upload or moderation service.

### Development-only behavior

- Development JWT fallback secret.
- Development failed-login `console.warn` includes attempted email.
- `allowedDevOrigins` accepts `192.168.*.*` plus configured patterns.
- Docker Compose local PostgreSQL credentials.
- Six extraneous WASM/NAPI packages in local `node_modules`, not manifests.

## 15. Missing backend and business logic

This records absence only.

### UI/schema present but backend incomplete

- comments: display/count only, no write API/form;
- post/profile/listing/guide/message media: metadata/copy only;
- Marketplace selling: disabled UI despite create API;
- Profile Marketplace/Saved: disabled/unrendered;
- Settings/Language: static navigation/status;
- Admin tabs/actions: disabled;
- Analytics: seed/chart only, no runtime writes;
- Notifications: broad schema but narrow producers;
- Message IMAGE/DOCUMENT and OAuth: schema only;
- Guide action URLs/covers: fields not presented;
- Best answer: displayed but no mutation.

### Incomplete business rules

- Home personalization query is global.
- Event View all uses unsupported filter vocabulary.
- Private-community and record-status read restrictions are inconsistent.
- Search publicly serializes internal users and private communities.
- Onboarding can persist inconsistent location/campus combinations.
- Private communities have no invitation path.
- EVENT does not require date/location.
- Verification/trust labels are not backed by member trust records.
- Header notification dot is not unread-driven.
- Admin weekly analytics are not date-bounded.
- Listing expiry and expired Session indexes have no cleanup processes.
- Reports have lifecycle fields but no lifecycle mutation.
- Audit coverage is partial and unviewable.
- In-memory rate buckets reset per process and can accumulate keys.
- Remote messages require page refresh/navigation.
- DIRECT cardinality is an application convention.
- Soft polymorphic targets can become orphaned.

## 16. Missing CRUD matrix

| Domain                  | Create          | Read         | Update        | Delete        | Notes                 |
| ----------------------- | --------------- | ------------ | ------------- | ------------- | --------------------- |
| User/account            | ✅              | ✅           | 🟡 onboarding | ❌            | no lifecycle          |
| Country/City/University | ❌              | ✅           | ❌            | ❌            | seed only             |
| Community               | ❌              | ✅           | ❌            | ❌            | membership mutable    |
| Membership              | ✅              | ✅           | ❌ roles      | ✅ non-owner  | no invites/transfers  |
| Post                    | ✅              | ✅           | ❌            | ❌            | limited types in UI   |
| Comment                 | ❌              | ✅           | ❌            | ❌            | read only             |
| Reaction                | ✅ post         | ✅           | type state    | ✅ post       | comment absent        |
| Marketplace category    | ❌              | ✅           | ❌            | ❌            | seed only             |
| Listing                 | 🟡 API-only     | ✅           | ❌            | ❌            | no lifecycle          |
| Listing image           | 🟡 key          | 🟡 metadata  | ❌            | ❌            | not rendered          |
| Listing favorite        | ✅              | ✅           | n/a           | ✅            | complete              |
| Guide/step              | ❌              | ✅           | ❌            | ❌            | seed only             |
| Guide progress          | ✅              | ✅           | ✅            | ✅            | complete state record |
| Question                | ✅              | ✅           | ❌            | ❌            | no moderation CRUD    |
| Answer                  | ✅              | ✅           | ❌            | ❌            | no moderation CRUD    |
| Answer vote             | ✅              | ✅           | ✅            | ✅            | complete              |
| Bookmark                | ✅              | ✅           | n/a           | ✅            | partial UI use        |
| Notification            | 🟡              | ✅           | 🟡 bulk read  | ❌            | no delivery admin     |
| Conversation            | ✅ first send   | ✅           | 🟡 timestamps | ❌            | no archive UI         |
| Message                 | ✅              | ✅           | ❌            | ❌            | text only             |
| Block                   | ✅              | ✅           | n/a           | ✅            | conversation UI       |
| Report                  | ✅ conversation | ✅ summary   | ❌            | ❌            | no resolution         |
| AuditLog                | ✅ selected     | ❌ UI        | ❌            | ❌            | no viewer             |
| AnalyticsEvent          | 🟡 seed         | ✅ aggregate | ❌            | ❌            | no instrumentation    |
| OAuthAccount            | ❌              | ❌           | ❌            | ❌            | placeholder           |
| Session                 | ✅              | ✅ internal  | ❌            | ✅ logout API | no UI                 |
| Explore content         | code            | ✅           | code          | code          | no persistence        |
| Settings/language       | ❌              | 🟡 static    | ❌            | ❌            | theme local only      |

## 17. CMS and administration analysis

| Module                | CMS/admin required?                     | What must be managed                                              | Current state         |
| --------------------- | --------------------------------------- | ----------------------------------------------------------------- | --------------------- |
| Marketing/legal       | Yes                                     | copy/claims and versioned policy publication                      | source only           |
| Users/reference data  | Admin                                   | status/roles/sessions; countries/cities/universities/verification | read overview         |
| Communities           | Yes + moderation                        | CRUD, verification/privacy, owners/members/announcements          | none                  |
| Posts/comments/events | Yes + moderation                        | status/pin/removal/events/reports                                 | user Post create only |
| Marketplace           | Yes + trust                             | categories, status/expiry, images, fraud/reports                  | count only            |
| Student Hub           | Yes if curated                          | cards/order/campaigns                                             | none                  |
| Guides                | Yes                                     | guide/step CRUD, review/publish, feature/version/source           | none                  |
| Q&A                   | Yes + moderation                        | categories/status/best answer/reports                             | user create/vote      |
| Messages              | Restricted safety admin, not normal CMS | evidence/retention/assignment/resolution                          | report create/summary |
| Profiles              | User self-service + admin               | edit/privacy/status/role/verification                             | none                  |
| Notifications         | Configuration/admin                     | templates/announcements/preferences/delivery                      | bulk user read        |
| Search                | Operations, not content CMS             | indexing/query/privacy review                                     | none                  |
| Explore               | Yes, high priority                      | city/section/entry/source/partner/order/review/expiry             | code only             |
| Language              | Localization governance                 | translations and locale releases                                  | none                  |
| Audit/analytics       | Restricted operations                   | access/retention/time filters/export                              | aggregate chart       |
| Media                 | Asset admin/moderation                  | upload ownership/metadata/review/delete/retention                 | columns only          |

No module has complete administration CRUD. The only admin interface is the read-only overview.

## 18. Dependencies and quality coverage

### Direct dependencies

| Package                 | Declared | Installed | Purpose                 |
| ----------------------- | -------: | --------: | ----------------------- |
| Next.js                 | ^16.2.10 |   16.2.10 | framework/runtime/build |
| React/React DOM         |  ^19.2.7 |    19.2.7 | UI                      |
| Prisma Client           |  ^5.22.0 |    5.22.0 | ORM                     |
| bcryptjs                |   ^2.4.3 |     2.4.3 | password hash           |
| jose                    |   ^5.9.6 |    5.10.0 | JWT                     |
| Zod                     |  ^3.23.8 |   3.25.76 | validation              |
| next-themes             |   ^0.4.6 |     0.4.6 | theme                   |
| Framer Motion           | ^12.42.2 |   12.42.2 | transition              |
| Lucide React            |  ^1.24.0 |    1.24.0 | icons                   |
| Radix Slot              |   ^1.3.0 |     1.3.0 | composition             |
| CVA/clsx/tailwind-merge | declared | installed | class variants/merge    |

Development dependencies are TypeScript, ESLint/Next config, Tailwind/PostCSS/Autoprefixer, Prisma CLI, tsx, Prettier, Vitest and types. Required environment is Node ≥20.9, PostgreSQL, DATABASE_URL, production JWT_SECRET and canonical NEXT_PUBLIC_APP_URL. Storage variables are unused. Docker provides PostgreSQL 16. Vercel is documented; no CI workflow exists.

Current production dependency audit: transitive PostCSS `<8.5.10` XSS advisory through Next.js. Registry offers an unrelated breaking Next.js downgrade. Result: two moderate records, zero high, zero critical.

### Tests present

- 4 cookie transport cases; 3 authorization cases; 3 Explore registry cases;
- 1 mocked login/session/Set-Cookie case; 1 message-key case;
- 5 validation cases; total 17 passing tests.

### Tests absent

- database integration/migration, E2E/browser/mobile, accessibility/visual;
- private/status authorization boundaries and Search serialization;
- messaging transactions/block/report/unread integration;
- community/marketplace/guide/bookmark/notification/admin/onboarding integration;
- performance/load/security automation and CI.

### Security controls and limitations

Present: bcrypt, signed/hashed revocable sessions, active-user check, secure cookie policy, mutation origin checks, Zod, CSP/security headers, Prisma parameterization, React escaping, Admin role gate, membership posting, conversation participation/blocking, selected audit/limits.

Limitations: critical Search exposure; private/status read gaps; in-process limits; no recovery/MFA/session management; no secure media; no moderation actions/retention; plaintext OAuth token columns if populated; demo credentials/destructive seed; no CI security scanning or observability.

## 19. Folder structure

```text
app/
  (platform)/            authenticated pages under AppShell
  admin/                 role-gated read-only overview
  api/                   22 route files / 32 HTTP operations
  about|guidelines|.../  public editorial pages
  login|register/        authentication forms
  onboarding/            protected setup
  layout.tsx/page.tsx    root metadata/theme and landing
src/
  components/app/        shell/navigation
  components/features/   domain UI/interactions
  components/ui/         Button/Card/Avatar/PageHeader
  components/marketing|onboarding|providers/
  features/explore/      contracts, registry, hardcoded Jiaxing
  lib/                   auth, Prisma, queries, validation, messaging,
                         authorization, rate-limit, request/audit helpers
prisma/
  schema.prisma          canonical PostgreSQL model
  migrations/            two SQL migrations
  seed.ts                destructive demo data
tests/unit/              6 files / 17 tests
docs/                     product/technical documentation
public/                   one Open Graph image
```

Important root files are package manifests/scripts, Next/Tailwind/PostCSS/ESLint/Vitest/TypeScript config, Docker Compose, `.env.example`, and README. `.env`, dependencies/build output/logs/coverage/TypeScript build info are ignored. The audited directory has no Git metadata.

## 20. Final summary

### 1. Existing modules

Marketing/policies; authentication; onboarding/location; shell; Home; Communities/Posts/Comments/Reactions; Marketplace; Student Hub; Guides; Help/Q&A; Messages; Profiles; Notifications; Search; Explore Jiaxing; Settings/Language/Theme; Admin/Reports/Audit/Analytics; media metadata.

### 2. Existing systems

Database-backed signed sessions, roles, Zod, same-origin mutation checks, in-process limits, audit writes, normalized location, memberships/content statuses, bookmarks/favorites/progress/votes, canonical direct conversations/read state/block/report, synchronous message notifications, typed city registry and reusable UI primitives.

### 3. Missing systems

Account recovery/verification/session management; secure media; comments backend; owner CRUD; realtime/asynchronous messaging/notifications; shared limits; runtime analytics; localization/preferences; robust search; observability/CI; export/deletion/retention; live city/partner services.

### 4. Missing CMS

Marketing/legal, reference data, communities/content/events, marketplace, Student Hub curation, guides, Q&A, Explore, notification/localization and asset management.

### 5. Missing Admin functionality

Users/status/roles/sessions; communities/members; moderation; listing lifecycle/fraud; guide publishing; Q&A/best answer; report assignment/resolution; audit browser; time-bounded analytics; city/source/media review. Admin is read-only.

### 6. Missing backend logic

Comments, upload/media, profile/settings updates, listing lifecycle, guide publishing, best-answer mutation, individual notification preferences, runtime analytics, localization, Explore persistence, most moderation actions.

### 7. Missing CRUD

No core authored domain has full CRUD. Membership, favorites, progress, votes, bookmarks, blocks and logout are the most complete state operations. Core resources are Create/Read or Read only.

### 8. Module dependencies

Identity is universal. Student Hub composes Guides/Q&A/Events. Home composes Community/Guides/Marketplace/Events. Messages consumes Users and emits Notifications/Reports/Audit. Search consumes six domains and causes the critical exposure. Admin reads operational tables. Explore remains isolated source data.

### 9. Overall maturity

**Implementation maturity: 53%.** Kondo is a credible functional MVP/demo with passing checks and production build. It is not production-ready because of the critical Search exposure, read-authorization gaps, missing operational administration, incomplete account/media/moderation lifecycle and broad missing CRUD.

### 10. Recommended implementation order

1. Close Search data exposure and direct-read authorization/status gaps.
2. Establish account safety and operational moderation/report actions.
3. Complete core content CRUD, beginning with comments and owner edit/delete/status.
4. Establish secure media before enabling listing creation or attachments.
5. Complete Marketplace lifecycle and trust/report workflows.
6. Complete Guide/Q&A editorial and accepted-answer administration.
7. Make notifications, analytics and rate limits production-capable.
8. Add profile/settings/privacy self-service and localization foundations.
9. Move Explore Jiaxing to governed CMS data with source/freshness review.
10. Add integration/E2E/security/accessibility/visual/performance coverage and observability.

This order reflects current blockers and dependencies. It does not redesign Kondo or add scope beyond what the present UI, schema, documentation and roadmap already represent.
