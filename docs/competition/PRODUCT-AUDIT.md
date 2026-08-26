# Kondo — Product Audit

**Audit date:** 25 August 2026
**Commit audited:** `60542d5`
**Method:** direct inspection of the repository (routes, Prisma schema, business-logic
modules, test suites) plus a running production build of the application, driven in a
real browser at a Pixel 7 viewport.

This document is the factual foundation for the competition dossier. Nothing in the
dossier should claim more than this audit supports.

---

## 1. Scale of what exists

| Measure                                   | Count                                        |
| ----------------------------------------- | -------------------------------------------- |
| Page routes                               | 198                                          |
| API routes                                | 283                                          |
| Prisma models                             | 142                                          |
| Prisma enums                              | 144                                          |
| Applied database migrations               | 75                                           |
| Server/business-logic modules (`src/lib`) | 195                                          |
| Unit test files                           | 107                                          |
| Integration test files (real PostgreSQL)  | 35                                           |
| Browser journey specs (Playwright)        | 24                                           |
| Automated tests passing                   | 1023 unit/integration + 128 browser journeys |

CI (`Release checks`) runs formatting, lint, typecheck, the full test suite, a production
build, all browser journeys, and a production dependency audit. It is green on `main`.

---

## 2. Account types and roles

Kondo has **two account dimensions**, which is what makes the two-sided model possible.

### 2.1 Personal accounts

One personal account type (`Role.MEMBER`), differentiated by **Journey**, not by account
class. The Journey drives what Home prioritises and what onboarding asks:

- `PREPARING_FOR_CHINA` — prospective and admitted students
- `STUDYING_AND_LIVING_IN_CHINA` — current students
- `CAREER_ALUMNI_AND_ENTREPRENEURSHIP` — alumni and professionals

There is no separate "non-student" personal account. A professional or alumnus uses the
same account with a different Journey.

### 2.2 Organization accounts

Separate `Organization` entity with its own workspace, membership model and lifecycle.

- **Types:** `COMPANY`, `UNIVERSITY`, `EDUCATION_AGENCY`, `HOUSING_PROVIDER`,
  `STUDENT_ASSOCIATION`, `EMBASSY_OR_CONSULATE`, `RECRUITMENT_ORGANIZATION`,
  `SERVICE_PROVIDER`, `OTHER`
- **Member roles:** `OWNER`, `ADMIN`, `MANAGER`, `MEMBER`, `EDITOR`, `VIEWER`
- **Capabilities** (per-organization feature grants): `HOUSING`, `SCHOLARSHIPS`,
  `INTERNSHIPS_JOBS`, `PRODUCTS`, `STUDENT_SERVICES`, `EVENTS`,
  `UNIVERSITY_INFORMATION`
- **Lifecycle:** draft → active, with a separate `publicProfileStatus` and a
  `verificationStatus` with a document-backed review queue

A capability must be `ENABLED` before the matching surface will publish anything. This is
the mechanism that would let a Jiaxing restaurant publish products without also being able
to publish job offers.

### 2.3 Platform roles

`MEMBER` → `MODERATOR` → `ADMIN` → `SUPER_ADMIN`, with a granular permission matrix
(`src/lib/authorization.ts`) and a 48-page admin console covering moderation, verification,
content, reference data and analytics.

---

## 3. Feature classification

Honest status for every module named in the brief. Definitions:

- **Working** — implemented, exercised by tests, and demonstrated in a browser.
- **Implemented but incomplete** — real and usable, with a named gap.
- **Prototype** — the path exists end to end but is not production-ready.
- **Infrastructure only** — schema/plumbing exists; no usable surface yet.
- **Requires external key** — the code is real and calls a real provider, but no
  credential is configured in this environment, so it could not be demonstrated.

### 3.1 Working — demonstrated in a browser

| Module                          | Notes                                                                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home / Kondo Life**           | Journey-prioritised section order. Kondo Life is a horizontal rail; the greeting is its first slide. Measured CLS 0.0000.                                                         |
| **Onboarding**                  | 3 steps (Journey → details → focus), searchable country/city/university selectors, keyboard-aware, "Step N of M".                                                                 |
| **Registration**                | Email/password, intent split (personal vs organization), password rules, terms gate.                                                                                              |
| **Student Hub**                 | Landing plus Study, Guide, Opportunities, Tools, Resources sections.                                                                                                              |
| **Workspace**                   | Today's classes from a real schedule, post-class review, note capture (photo/document/voice).                                                                                     |
| **Study Essentials**            | 18 catalogue items; Browse / My Library / My Notes.                                                                                                                               |
| **Digital books + EPUB Reader** | Real EPUB parsing (epub.js), pagination, CFI positions, chapter navigation, highlights, notes, tasks-from-passage, reading position persisted across reload. 11 browser journeys. |
| **Guide**                       | 15 guides (arrival, bank account, SIM, residence permit, emergencies).                                                                                                            |
| **Communities**                 | 8 seeded communities, posts, comments with replies, reactions, moderation.                                                                                                        |
| **Student Story / Reels**       | Vertical feed, muted autoplay on scroll, one video at a time, owner delete, publish flow.                                                                                         |
| **Marketplace**                 | Listings, categories, cities, filters, sort, favourites, seller dashboard, reporting.                                                                                             |
| **Marketplace messaging**       | Listing-scoped conversations, separate inbox, listing context in-thread, duplicate-thread prevention at the database level.                                                       |
| **Food & Services**             | Public projection of organization products and services.                                                                                                                          |
| **Organizations**               | Creation, workspace, public storefront, catalogue (products + services), team, verification submission, opportunities workspace.                                                  |
| **Messaging**                   | Direct conversations, attachments, read state, blocking, archiving, safety reporting.                                                                                             |
| **Notifications**               | Templated, queued, deduplicated, with an admin template console.                                                                                                                  |
| **Discover**                    | Cross-entity discovery across marketplace, housing, opportunities, organizations, communities, cities, universities, events, skills.                                              |
| **Jiaxing city hub**            | `/explore/jiaxing` — a curated city gateway. See §5.                                                                                                                              |
| **Profiles & settings**         | Profile, privacy, sessions, appearance, notifications, official-profile request.                                                                                                  |
| **Admin console**               | 48 pages: moderation, verification, media, reports, reference data, analytics, city hubs.                                                                                         |

### 3.2 Implemented but incomplete

| Module                   | Gap                                                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Opportunities**        | Full publishing, application and review pipeline exists (organization workspace → student application → applicant review). **Zero opportunities in the database**, so it has never been exercised with real content. |
| **Housing**              | Listings, search, saved, roommates, requests, organization housing workspace all exist. **Zero housing listings.**                                                                                                   |
| **Nearby / Looking For** | Real km distances from city coordinates, no map. Depends on students setting a location; unproven at density.                                                                                                        |
| **Meet**                 | Queue and matching logic exist; video calling is wired to LiveKit. **No LiveKit credentials configured** — video cannot be demonstrated.                                                                             |
| **Scholarships**         | Listings and agent directory exist; content is thin.                                                                                                                                                                 |

### 3.3 Requires an external key — could not be demonstrated

| Module                                                                                                 | Status                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI study assistant** (Explain / Translate / Simplify / Why it matters, from a passage in the reader) | Real code calling the Anthropic API (`src/lib/study-assistant.ts`). `ANTHROPIC_API_KEY` is **not set** in this environment. The feature degrades honestly: it returns a 503 with "The study assistant is not configured yet. Highlights, notes and tasks still work." **I could not verify a working AI response and do not claim one.** |
| **AI timetable import** (photo/PDF of a class schedule → structured timetable)                         | Real code calling DeepSeek (`src/lib/schedule-ai.ts`). `DEEPSEEK_API_KEY` **not set**. Same caveat.                                                                                                                                                                                                                                      |

### 3.4 Prototype / simulated

| Module                  | Status                                                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Payments / checkout** | `SIMULATED` is the only wired provider. `ALIPAY`, `WECHAT_PAY`, `CARD` are declared in the schema so adding one is an adapter change, not a migration — but **no real payment has ever been processed**. |

### 3.5 Infrastructure only

| Module                | Status                                                                                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-language UI** | A language preference is stored per user and there is a settings page, but **the interface is English only**. The settings copy says so: "as reviewed translations become available." No Chinese UI exists today. |

---

## 4. Reference data — a real asset

This is genuine, loaded data, not placeholders:

| Dataset                 | Count                        |
| ----------------------- | ---------------------------- |
| Countries               | 242                          |
| Cities                  | 346                          |
| Universities            | 2,952 (Chinese institutions) |
| Cities in Zhejiang      | 11                           |
| Universities in Jiaxing | 6                            |

Jiaxing is present with coordinates (30.7522, 120.75), province Zhejiang, and six
institutions: Jiaxing University, Jiaxing Nanhu College, Zhejiang University of Finance &
Economics Dongfang College, Tongji Zhejiang College, Jiaxing Vocational & Technical
College, Jiaxing Nanyang Vocational & Technical College.

---

## 5. The Jiaxing city hub — already built

`/explore/jiaxing` is a 769-line curated city gateway, and **Jiaxing is the only city with
one**. It is titled _"Jiaxing, open by design."_ and its own summary card names the
proposition as **"Kondo bridge: Students ↔ city opportunity."**

Sections that already exist:

- **Local Companies** — Tongkun Group, Flat Glass Group, Xinfengming Group, Tong Ming
  Zhejiang, cross-border digital trade
- **Local Products** — polyester & technical textiles, fashion & knitwear, photovoltaic
  glass, industrial fasteners, Jiaxing specialities
- **Universities** — Jiaxing University, Jiaxing Nanhu University, Yangtze Delta
  innovation ecosystem
- **Jobs & Internships** — five illustrative pathways
- **Local Events** — textile & fashion fairs, innovation competitions, digital economy
  exchange, university activities, cultural festivals
- **City Services** — transport, hospitals, banks, government offices, public services,
  emergency contacts
- **About Jiaxing**

**Honesty note, and it matters:** every company entry cites an official source URL and
carries the status **"Future company profile ready"**. These are _editorial_ entries
describing real Jiaxing companies from public information — they are **not** claimed
platform accounts, and no company has been contacted, onboarded or partnered with. The
hub is a curated guide that is _structured to receive_ real organization accounts later.

---

## 6. Features excluded from the dossier's "what works today" claims

Excluded because they are incomplete, unproven or undemonstrable:

1. **AI study assistant** — no API key; cannot show a real answer.
2. **AI timetable import** — no API key.
3. **Video calling / Meet** — no LiveKit credentials.
4. **Real payments** — simulated provider only.
5. **Opportunities with real content** — pipeline exists, zero records.
6. **Housing with real content** — module exists, zero listings.
7. **Chinese-language interface** — does not exist.
8. **Any user, revenue, partnership or adoption metric** — there are none.

---

## 7. Assumptions requiring verification before the competition

These are things I could **not** verify from the repository and that you should confirm:

1. **Whether the platform is live in production.** I verified the code is on GitHub and CI
   is green; I have no access to the Vercel deployment and cannot confirm the public site
   reflects `60542d5`.
2. **Real user numbers.** None exist in the repository. If Kondo has any real users, only
   you can supply that figure. The dossier states zero.
3. **Jiaxing company facts.** The city hub cites public sources for Tongkun, Flat Glass,
   Xinfengming and Tong Ming. Verify these remain accurate before presenting them.
4. **Legal position on student employment.** The dossier deliberately makes no claim about
   what international students may legally do. Chinese regulation on part-time work and
   internships for student-visa holders should be confirmed with your university's
   international office before the opportunity narrative is presented to a jury.
5. **University relationship.** No endorsement, agreement or contact with Jiaxing
   University exists in the codebase. Any statement about institutional support must come
   from you.
6. **Copyright position for the digital library.** The reader has entitlement checks and
   licence flags (`aiAllowed`, `downloadAllowed`), and the pilot book is a
   Kondo-authored sample. Any real catalogue needs cleared rights.
7. **Data protection compliance.** PIPL applicability and data-residency requirements for
   a platform serving students in China have not been assessed.
8. **Whether "Kondo" is registered** as a name/trademark in China.
