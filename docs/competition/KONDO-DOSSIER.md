# KONDO

### A student-first bridge between international students in China and the city around them

**Project dossier — entrepreneurship & innovation competition, Jiaxing, Zhejiang**
Version 1.0 · 25 August 2026 · Source commit `60542d5`

---

> **How to read this document**
>
> Every claim carries a label. There are four, and they are used strictly:
>
> | Label                        | Meaning                                                                         |
> | ---------------------------- | ------------------------------------------------------------------------------- |
> | **[BUILT]**                  | Exists in the product today. Verified in a running browser.                     |
> | **[BUILT, UNPROVEN]**        | Implemented and tested, but never used with real content or real users.         |
> | **[NEEDS KEY]**              | Real code calling a real provider; no credential configured, so undemonstrated. |
> | **[PLANNED]** / **[VISION]** | Not built. A stated intention or a long-term hypothesis.                        |
>
> Kondo has **no users, no revenue, no partnerships and no institutional endorsement**.
> Where this document discusses adoption, it discusses _targets_. The full evidence base is
> in [`PRODUCT-AUDIT.md`](./PRODUCT-AUDIT.md).

---

## 1. Executive summary

China has built one of the world's most capable digital and service ecosystems. For an
international student arriving in Jiaxing, the difficulty is not that services are
missing — it is that the **local knowledge required to reach them** is scattered, informal,
and mostly in a language they are still learning.

Kondo is an **orientation and integration layer**. One account where an international
student's studies, community, daily life and access to the local city sit together.

The platform has two connected sides:

- **Side A — students.** Study tools, a digital library with a working reader, arrival
  guides, communities, a marketplace, and local discovery. **[BUILT]**
- **Side B — Jiaxing.** Organization accounts with public storefronts, product and service
  catalogues, opportunity publishing, and direct messaging with students. **[BUILT,
  UNPROVEN]** — the capability exists; no business has yet been onboarded.

These are not two products. **The student side earns the audience; the city side reaches
it.** That exchange is the business.

Kondo is a working platform, not a concept: **198 page routes, 283 API routes, 142 database
models, 1,023 automated tests and 128 browser journeys, green in continuous integration.**
And Jiaxing is already its reference city — `/explore/jiaxing` is the only city hub in the
product, and it names its own purpose _"Kondo bridge: Students ↔ city opportunity."_

**What we are asking for is a pilot**, in the one city where the product is already
pointed.

---

## 2. Vision

> Every international student in China should arrive already oriented — and every city that
> hosts them should be able to reach them.

Kondo began as a platform for African students in China. The problem turned out not to be
national: a Ghanaian, a Kazakh and a Pakistani student in Jiaxing face the same first
semester. The vision widened to **international students in China**, and then widened
again — because solving a student's orientation problem necessarily means connecting them
to a _place_, and a place has businesses, employers, services and an economy.

That second half is what makes Kondo more than a student utility. **An orientation platform
is, structurally, a local commerce and opportunity channel.**

---

## 3. The international student challenge

Framing matters. **Nothing here is a criticism of China or of Jiaxing.** These are the
predictable costs of being new to a highly developed system.

| Challenge                           | What it actually looks like                                                                                                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **An unfamiliar digital ecosystem** | Payments, transport, delivery and campus services all work superbly — once you have a Chinese bank account, a local number, and know which app does what. Before that, none of it is reachable. |
| **Information fragmentation**       | The answer to "how do I get a residence permit" exists — in a WeChat group, from a senior, on a noticeboard, in an office. It is rarely in one place, and rarely current.                       |
| **Language**                        | Not an absolute barrier, but a constant tax on speed. Most orientation-critical information is written for people who read Chinese fluently.                                                    |
| **Finding trusted local services**  | A student needs a barber, a clinic, a phone repair, a place to eat. Discovery depends on who you happen to know.                                                                                |
| **Academic organisation**           | Timetables, materials and coursework arrive through several channels, often in formats built for domestic students.                                                                             |
| **Finding relevant opportunities**  | Internships and events exist; visibility to international students is inconsistent.                                                                                                             |
| **Finding community**               | Communities form informally and are hard to join without an introduction.                                                                                                                       |
| **Before arrival**                  | The period when guidance would be most valuable is the period when a student has the least access to it.                                                                                        |

**The honest characterisation:** this is a _temporary knowledge gap_, not a deficiency. It
closes on its own in six to twelve months. Kondo's argument is that closing it in the first
six weeks is worth something — to the student, and to the city.

---

## 4. Why Jiaxing

Jiaxing is not a convenient example. It is where the product is already pointed.

| Factor                | Detail                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Universities**      | 6 institutions in Kondo's reference data, including Jiaxing University and Jiaxing Nanhu College                                |
| **Position**          | Between Shanghai and Hangzhou, in the Yangtze River Delta                                                                       |
| **Economic identity** | Textiles and technical materials, photovoltaic glass, advanced manufacturing, cross-border digital trade                        |
| **Scale**             | Small enough to reach a meaningful share of the international student population; large enough for the result to mean something |
| **Business access**   | Local restaurants and services can be onboarded in person — the hardest part of any two-sided launch                            |
| **Measurability**     | One city produces observable adoption rather than estimated adoption                                                            |

**And Kondo already treats it as home. [BUILT]** `/explore/jiaxing` is a 769-line curated
city gateway — the only one in the product — covering local companies, local products,
universities, internships, events and city services.

---

## 5. The Kondo solution — one ecosystem, five jobs

Kondo is organised around what a student is trying to _do_, not around a feature list.

### LIVE — the city around you

Marketplace · Food & Services · local discovery · Nearby · communities
**[BUILT]** — marketplace with categories, filters, favourites and seller tools;
Food & Services as a public projection of organization catalogues.

### STUDY — the academic core

Student Hub · Workspace · Planner · Study Essentials · digital library · EPUB reader
**[BUILT]** — Workspace builds from a real class schedule; the reader does genuine EPUB
pagination, highlights, notes, tasks-from-passage, and keeps your position across devices.
AI study actions are **[NEEDS KEY]**.

### ADAPT — becoming a resident

Guide · pre-arrival information · city services · Jiaxing hub
**[BUILT]** — 15 guides covering bank accounts, SIM cards, residence permits, first 72
hours and emergency contacts.

### GROW — after graduation starts before graduation

Opportunities · organizations · company discovery · scholarships
**[BUILT, UNPROVEN]** — the full pipeline exists (publish → discover → apply → review) but
contains zero opportunities.

### CONNECT — people, not just information

Student Story reels · communities · messaging · student discovery
**[BUILT]** — vertical reels feed with autoplay, communities with posts and threaded
comments, direct and listing-scoped messaging.

---

## 6. Product ecosystem — what actually exists

| Layer                    | Count |
| ------------------------ | ----- |
| Page routes              | 198   |
| API routes               | 283   |
| Database models          | 142   |
| Applied migrations       | 75    |
| Business-logic modules   | 195   |
| Automated tests passing  | 1,023 |
| Browser journeys passing | 128   |

Continuous integration runs formatting, lint, typecheck, the full test suite, a production
build, every browser journey, and a production dependency audit. **Green on `main`.**

---

## 7. Student experience

**Accounts.** One personal account type, differentiated by **Journey** rather than account
class — `PREPARING_FOR_CHINA`, `STUDYING_AND_LIVING_IN_CHINA`,
`CAREER_ALUMNI_AND_ENTREPRENEURSHIP`. The Journey drives what onboarding asks and what Home
prioritises, so a student still applying sees their checklist first while a current student
sees campus life first. **[BUILT]**

**Onboarding.** Three steps with searchable selectors over 242 countries, 346 cities and
2,952 universities, keyboard-aware on mobile, with a quiet "Step N of M". **[BUILT]**

**Home / Kondo Life.** A live rail of what is happening across Kondo, with the greeting as
its first slide. Measured cumulative layout shift: **0.0000**. **[BUILT]**

---

## 8. Study & academic ecosystem

The strongest part of the product.

- **Workspace** — today's classes from a real schedule, post-class review, note capture by
  photo, document or voice **[BUILT]**
- **Study Essentials** — an 18-item catalogue split into Browse, My Library, My Notes
  **[BUILT]**
- **EPUB Reader** — real `epub.js` parsing: pagination, chapter navigation, CFI-anchored
  highlights that survive a font-size change, notes, and **tasks raised from a passage that
  land in the planner**. Reading position persists across reload and device. Three reading
  themes. 11 browser journeys cover it. **[BUILT]**
- **AI study actions** — Explain, Translate, Simplify, Why this matters, from a selected
  passage. Real Anthropic API integration. **[NEEDS KEY]** — no credential in this
  environment, so **no working AI response has been demonstrated and none is claimed.** The
  feature fails honestly: _"The study assistant is not configured yet. Highlights, notes
  and tasks still work."_
- **AI timetable import** — photo or PDF of a class schedule into a structured timetable,
  via DeepSeek. **[NEEDS KEY]**

---

## 9. Community & student life

- **Communities** — 8 seeded communities with posts, threaded comments, reactions and
  moderation **[BUILT]**
- **Student Story / Reels** — vertical short-video feed, muted autoplay on scroll, exactly
  one video playing at a time, owner delete with inline confirmation, publish flow
  **[BUILT]**
- **Messaging** — direct conversations with attachments, read state, blocking, archiving
  and safety reporting **[BUILT]**
- **Nearby / Looking For** — real kilometre distances from city coordinates, deliberately
  without a map **[BUILT, UNPROVEN]** — depends on student density Kondo does not have
- **Meet** — matching queue exists; video calling wired to LiveKit but **no credentials
  configured** **[NEEDS KEY]**

---

## 10. Local discovery

- **Marketplace** — student-to-student listings with categories, city filters, price
  sorting, favourites, a seller dashboard, and reporting **[BUILT]**
- **Marketplace messaging** — a buyer's question about a listing opens a conversation
  _scoped to that listing_, in a separate Marketplace inbox, with the item's photo, title
  and price pinned in the thread. A database-level uniqueness rule prevents a second
  thread for the same buyer and listing. **[BUILT]**
- **Food & Services** — a public projection of organization products and services. This is
  the surface where a Jiaxing restaurant reaches students. **[BUILT]**
- **Discover** — cross-entity search across marketplace, housing, opportunities,
  organizations, communities, cities, universities, events and student skills **[BUILT]**

---

## 11. Organizations & businesses — Side B in detail

This is the part that makes the Jiaxing proposition real rather than aspirational.

**Organization accounts** are a separate entity from personal accounts, with their own
workspace, team and lifecycle. **[BUILT]**

| Element           | Detail                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Types**         | Company, university, education agency, housing provider, student association, embassy/consulate, recruitment organization, service provider, other |
| **Team roles**    | Owner, admin, manager, member, editor, viewer                                                                                                      |
| **Capabilities**  | Housing, scholarships, internships & jobs, products, student services, events, university information — each individually granted                  |
| **Lifecycle**     | Draft → active, with separate public-profile status and a document-backed verification queue                                                       |
| **Storefront**    | Public profile with logo, cover, description and catalogue                                                                                         |
| **Catalogue**     | Products and services with images, prices, availability, categories                                                                                |
| **Inquiries**     | Students contact a business; the conversation is scoped to the item                                                                                |
| **Opportunities** | Publish → student applies → applicant review workspace                                                                                             |

**Capabilities are the important design decision.** A restaurant gets `PRODUCTS` and
`STUDENT_SERVICES` and nothing else. A manufacturer gets `INTERNSHIPS_JOBS`. Nothing is
publishable until the matching capability is enabled — so the platform can onboard very
different kinds of Jiaxing organisation without one becoming a channel it should not be.

---

## 12. Kondo × Jiaxing

### A. Local business discovery **[BUILT]**

International students browse Jiaxing restaurants, shops, services and products inside a
platform they already use for study and community.

### B. Business digital storefronts **[BUILT, UNPROVEN]**

A Jiaxing business creates an organization account and publishes a storefront with
products, services, prices and images. Verified. Demonstrated with a sample restaurant.
**No real business has been onboarded.**

### C. International customer access **[BUILT]**

Today a Jiaxing restaurant wanting international student customers has no practical route
to them. Kondo is one channel where those students already are, for reasons unrelated to
advertising.

### D. Restaurants and local services **[BUILT]**

Food & Services directs student spending toward local businesses. A student lunch set at
CN¥18 is exactly the kind of listing this surface is for.

### E. Employer and talent connection **[BUILT, UNPROVEN]**

Companies with the `INTERNSHIPS_JOBS` capability can publish internships, events and
competitions, and review applications.

> **Legal caution, stated deliberately.** This document makes **no claim** about what
> international students on a student visa may lawfully do in terms of paid work in China.
> Regulations on part-time employment and internships for student-visa holders must be
> confirmed with the university's international office and the relevant authorities before
> any employment-facing feature is promoted. Kondo's role is **visibility and
> connection** — not employment facilitation, and not legal advice.

### F. International visibility **[VISION]**

International students maintain ties to their home countries. A student who spent four
years in Jiaxing — who knows its companies and its food — is a potential link between
Jiaxing and their home market: cultural exchange, company visibility, alumni networks,
market understanding.

> **This is a hypothesis. It has not been measured, and Kondo does not claim it as a
> result.**

### G. City integration **[PLANNED]**

Students who navigate a city more easily participate in it more. The plausible effects —
better integration, higher satisfaction, more local service discovery, a stronger
reputation for Jiaxing as an international-student-friendly city — are the pilot's reason
for existing, and would need to be measured rather than asserted.

---

## 13. The two-sided ecosystem

```
            INTERNATIONAL STUDENTS                    K O N D O                     JIAXING ECOSYSTEM
            ─────────────────────                  ═══════════                   ──────────────────

              Study  ·  Life                    ┌───────────────┐                Companies · Restaurants
         Community  ·  Resources     ─────────► │               │ ◄─────────     Services  · Organizations
      Opportunities · Local discovery           │  ORIENTATION  │                Opportunities · Products
                                                │     LAYER     │
                                                └───────────────┘

      THEY RECEIVE                                                                  THEY RECEIVE
      ───────────                                                                   ───────────
      information · services                                                        visibility · discovery
      opportunities · community                                                     communication · engagement
      study tools · orientation                                                     an international audience

      THEY GIVE                                                                     THEY GIVE
      ─────────                                                                     ─────────
      attention · spending                                                          products · services
      feedback · presence                                                           opportunities · local knowledge
```

**In one line:** students get a city they can navigate; the city gets students it can
reach.

---

## 14. Student journey **[BUILT unless marked]**

1. **Before arrival** — creates an account, selects Journey `PREPARING_FOR_CHINA`
2. Home leads with the arrival checklist, not campus social life
3. **Guide** — reads _Your first 72 hours_, _Open a Chinese bank account_, _Residence permit_
4. **Arrives in Jiaxing** — switches Journey; Home reorders to student life
5. **Communities** — joins a national community and a campus community
6. **Student Hub** — imports a timetable **[NEEDS KEY]**; Workspace shows today's classes
7. **Library** — opens a set text in the reader, highlights a passage, raises a task to the
   planner
8. **Food & Services** — finds a restaurant near campus, sees a CN¥18 student lunch set
9. **Marketplace** — buys a desk from a departing student, messages them in a
   listing-scoped thread
10. **Opportunities** — sees an internship from a Jiaxing company **[BUILT, UNPROVEN]**
11. **Student Story** — posts a reel about their first month

---

## 15. Jiaxing business journeys **[BUILT, UNPROVEN — capability exists, no real business onboarded]**

### A restaurant near campus

Creates an organization account → type `SERVICE_PROVIDER` → `PRODUCTS` and
`STUDENT_SERVICES` enabled → submits verification → builds a storefront → publishes dishes
with photos and prices, plus a catering service → appears in **Food & Services** → students
browse, open the storefront, and start an inquiry conversation.

_Demonstrated with a sample restaurant, "Nanhu Kitchen", showing four products and one
service. Sample data, clearly labelled — not a real business._

### A Jiaxing manufacturer

Creates an organization account → type `COMPANY` → `INTERNSHIPS_JOBS` enabled → publishes a
company profile and an internship → international students discover it in Opportunities →
apply → the company reviews applications in its workspace.

### A student association or university office

Type `STUDENT_ASSOCIATION` or `UNIVERSITY` → `EVENTS` and `UNIVERSITY_INFORMATION` enabled →
publishes events and official information to a verified international audience.

---

## 16. Current product — screenshots

All captured from a running production build at a Pixel 7 viewport (desktop where noted).
Files in [`screenshots/`](./screenshots/).

| #   | File                          | Shows                                                         |
| --- | ----------------------------- | ------------------------------------------------------------- |
| 1   | `01-home.png`                 | Home with Kondo Life rail, greeting as first slide            |
| 2   | `02-student-hub.png`          | Student Hub                                                   |
| 3   | `03-workspace.png`            | Workspace                                                     |
| 4   | `04-essentials.png`           | Study Essentials catalogue                                    |
| 5   | `05-library.png`              | My Library                                                    |
| 6   | `06-reader.png`               | EPUB reader with selection actions                            |
| 7   | `07-guide.png`                | Guide                                                         |
| 8   | `08-communities.png`          | Communities                                                   |
| 9   | `09-reels.png`                | Student Story reels                                           |
| 10  | `10-marketplace.png`          | Marketplace grid                                              |
| 11  | `11-food.png`                 | **Food & Services with a Jiaxing storefront**                 |
| 12  | `12-opportunities.png`        | Opportunities (empty — no content)                            |
| 13  | `13-discover.png`             | Discover                                                      |
| 14  | `14-jiaxing-hub.png`          | **`/explore/jiaxing` — "Jiaxing, open by design."** (desktop) |
| 15  | `15-jiaxing-companies.png`    | **Jiaxing local companies** (desktop)                         |
| 16  | `16-marketplace-messages.png` | Marketplace inbox                                             |
| 17  | `17-profile.png`              | Profile                                                       |
| 18  | `18-org-new.png`              | Organization creation                                         |

**Not screenshotted, because it cannot be demonstrated:** a working AI study answer, AI
timetable import, video calling, a completed real payment. See `PRODUCT-AUDIT.md` §3.

---

## 17. Business model

**Today: no revenue, no paying customers, no users. Payments are simulated
(`SIMULATED` is the only wired provider).** **[BUILT — prototype]**

Potential monetisation, ordered by how much trust it costs:

| Model                              | Mechanism                                                                  | Trust cost                | Status              |
| ---------------------------------- | -------------------------------------------------------------------------- | ------------------------- | ------------------- |
| **Organization subscription**      | A Jiaxing business pays for a verified storefront, catalogue and analytics | Low                       | **[PLANNED]**       |
| **Opportunity posting**            | Companies pay to publish internships and events                            | Low                       | **[PLANNED]**       |
| **Promoted local listings**        | Clearly labelled placement in Food & Services / Marketplace                | Medium — only if labelled | **[PLANNED]**       |
| **Institutional partnerships**     | Universities or city bodies fund orientation content                       | Low                       | **[PLANNED]**       |
| **Digital resource partnerships**  | Publishers supply licensed study material                                  | Low                       | **[PLANNED]**       |
| **Privacy-safe business insights** | Aggregate, anonymised interest signals — never individual student data     | Medium                    | **[PLANNED]**       |
| **Premium student features**       | Optional student-side upgrades                                             | **High**                  | **Not recommended** |

**Two principles.**

1. **The student side stays free.** It is the audience. Charging it destroys the asset the
   city side pays for.
2. **Transaction commission is not the first move.** It needs payment infrastructure Kondo
   does not have and a trust position it has not earned.

---

## 18. Jiaxing pilot strategy

| Phase | Who                                                    | Goal                                               |
| ----- | ------------------------------------------------------ | -------------------------------------------------- |
| **1** | International students at one Jiaxing university       | Prove the student side is worth opening weekly     |
| **2** | International students across Jiaxing's 6 institutions | Reach density where community and marketplace work |
| **3** | Local restaurants and services                         | Prove a business will publish and answer students  |
| **4** | Selected Jiaxing companies                             | Prove opportunity flow works in both directions    |
| **5** | A second Chinese university city                       | Prove the model is not Jiaxing-specific            |

**National expansion is not proposed.** Jiaxing is the proof-of-concept city, and phases 1
and 2 must produce real weekly usage before phase 3 is worth anyone's time.

---

## 19. Competitive positioning

WeChat, Xiaohongshu, Meituan, Taobao and university groups are excellent products. **Kondo
does not compete with them and should not try.**

| Platform           | Strength                                         | What it does not provide                                  |
| ------------------ | ------------------------------------------------ | --------------------------------------------------------- |
| WeChat             | Universal communication, payments, mini-programs | International-student context; organised orientation      |
| Xiaohongshu        | Rich lifestyle discovery                         | Study tools; verified local business channel for students |
| Meituan / Dianping | Excellent local commerce                         | An international-student-facing surface                   |
| University groups  | Authoritative and specific                       | Persistence, searchability, pre-arrival access            |
| Marketplaces       | Scale and logistics                              | Campus-local student-to-student context                   |

**Kondo's differentiation is context, not features:**

- **International-student framing** — every surface assumes you are new here
- **Unified** — study, life, community and opportunity in one account
- **Pre-arrival** — usable before you have a Chinese number or bank card
- **Local business layer** — a channel to students no general platform builds for them
- **City-anchored** — Jiaxing is a first-class place in the product, not a filter value

Kondo is a **layer on top of** China's digital ecosystem, not a replacement for it.

---

## 20. Impact and KPIs

**Kondo has no users. Every number below is a TARGET for a one-semester Jiaxing pilot, not
a measurement.**

### Student side

| Metric                                                | Semester-1 target |
| ----------------------------------------------------- | ----------------- |
| Registered international students in Jiaxing          | 300               |
| Weekly active users                                   | 40% of registered |
| Students completing onboarding                        | 80% of registered |
| Students using Student Hub weekly                     | 30% of active     |
| Guides read per student (first month)                 | 3                 |
| Local business discoveries per active student / month | 2                 |
| Marketplace interactions                              | 150               |
| Community posts and comments                          | 500               |

### Business side

| Metric                          | Semester-1 target |
| ------------------------------- | ----------------- |
| Jiaxing organizations onboarded | 15                |
| Products / services published   | 60                |
| Storefront views                | 2,000             |
| Student → business inquiries    | 100               |
| Opportunities published         | 10                |
| Opportunity applications        | 50                |

### Ecosystem

| Metric                                           | Semester-1 target |
| ------------------------------------------------ | ----------------- |
| Distinct local services discovered               | 40                |
| Student ↔ business conversations                 | 100               |
| Organizations returning to publish a second time | 60%               |

**The single honest metric that matters:** _do students open Kondo in week 8 without being
asked?_ Everything else follows from that.

---

## 21. Technology and scalability

| Layer      | Choice                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------ |
| Framework  | Next.js 16 (App Router), React, TypeScript                                                 |
| Database   | PostgreSQL via Prisma — 142 models, 75 migrations                                          |
| Storage    | S3-compatible object storage with presigned reads and a media validation pipeline          |
| Media      | Upload → validation → scan → attach lifecycle, never served without an authorisation check |
| Auth       | Session-based, with granular admin permissions                                             |
| Real-time  | LiveKit for calls **[NEEDS KEY]**                                                          |
| AI         | Anthropic (study assistant), DeepSeek (timetable import) **[NEEDS KEY]**                   |
| Quality    | 1,023 tests + 128 browser journeys, enforced in CI                                         |
| Deployment | Vercel                                                                                     |

**Scalability posture.** The city model is data, not code: cities, universities and
countries are reference data (346 / 2,952 / 242 loaded). Adding a second pilot city means
adding a city hub, not rebuilding the product. Organization capabilities mean a new
category of local business is a configuration change.

---

## 22. Risks, safety and compliance

| Risk                          | Safeguard                                                                                                                                                    | Status                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| **User privacy**              | Per-user privacy settings, profile audience controls, session management                                                                                     | **[BUILT]**                                                                               |
| **Location privacy**          | Nearby uses city-level coordinates and shows distance only — deliberately no map                                                                             | **[BUILT]**                                                                               |
| **Content moderation**        | Reporting on posts, comments, listings, stories and conversations; admin moderation queues; publish-then-moderate for reels with removal and reason tracking | **[BUILT]**                                                                               |
| **Organization verification** | Document-backed verification queue; capability grants gate publishing                                                                                        | **[BUILT]**                                                                               |
| **Marketplace safety**        | Fraud scoring, listing reports, evidence snapshots, seller history, in-product safety guidance ("meet in a public place; Kondo never handles payment")       | **[BUILT]**                                                                               |
| **Media abuse**               | Upload validation, MIME sniffing, scan status; media never served without an authorisation check                                                             | **[BUILT]**                                                                               |
| **Data protection**           | Access control throughout                                                                                                                                    | **PIPL applicability and data-residency requirements have not been assessed** — see below |
| **Digital book copyright**    | Per-title entitlements, `aiAllowed` and `downloadAllowed` licence flags; the pilot book is Kondo-authored                                                    | **[BUILT]** — any real catalogue needs cleared rights                                     |
| **Employment compliance**     | No claim is made about student work rights                                                                                                                   | **Must be confirmed with the university and authorities**                                 |
| **Payments**                  | Simulated only; no real money has moved                                                                                                                      | **[BUILT — prototype]**                                                                   |
| **Platform abuse**            | Rate limiting, duplicate-message rejection, blocking, trusted-origin checks                                                                                  | **[BUILT]**                                                                               |

**Open compliance questions, stated plainly:**

1. PIPL applicability and data residency for a platform serving students in China
2. ICP filing requirements for operating a public platform in China
3. Legal position on international student employment before promoting opportunity features
4. Rights clearance for any real digital library catalogue
5. Trademark position for the name "Kondo" in China

---

## 23. Roadmap

**Now — [BUILT]**
Study, library and reader · guides · communities · reels · marketplace and marketplace
messaging · organizations with storefronts and catalogues · Food & Services · Jiaxing city
hub · admin and moderation console

**Next — pilot-blocking**
Configure AI credentials so study assistance and timetable import work · onboard the first
real Jiaxing businesses · publish the first real opportunities · **Chinese interface** (does
not exist today) · confirm the legal position on opportunities

**Then — pilot**
Phase 1–2 student adoption at Jiaxing institutions · phase 3 local business onboarding ·
measure against §20

**Later — [PLANNED]**
Organization subscriptions · real payment provider · second city · alumni network

---

## 24. Long-term vision **[VISION — none of this is built or measured]**

If the Jiaxing pilot works, three longer arcs open:

**A replicable city model.** Each Chinese university city gets a Kondo city layer:
students oriented, local businesses reachable. The product is already structured for this —
cities are data.

**A graduate bridge.** International students leave and stay connected. A network of alumni
who know Jiaxing's companies and economy is a channel between the city and dozens of home
markets — cultural exchange, company visibility, market understanding, entrepreneurship.

**Local businesses going outward.** The same connection that brings students to a Jiaxing
company can eventually carry that company's products to the students' home countries.

**All three are hypotheses.** They are stated because they are the reason the pilot is
worth running — not because any of them has happened.

---

## 25. Conclusion

Kondo is a working platform with a real Jiaxing dimension already built into it.

**What is true today:** a substantial product — 198 routes, 142 models, 1,023 tests green in
CI — covering study, community, local commerce and organization storefronts, with Jiaxing
as its only city hub and its explicitly stated purpose _"Students ↔ city opportunity."_

**What is not true today:** Kondo has no users, no revenue, no partnerships and no
onboarded businesses. Its AI features need credentials. Its interface is English only.

**What we are asking to prove:** that international students will use one platform for
study and city life — and that this makes them reachable by the Jiaxing businesses who
currently cannot find them.

That question can be answered in one semester, in one city, with the product that already
exists.

---

_Prepared from direct inspection of the Kondo repository at commit `60542d5`. Evidence base:
[`PRODUCT-AUDIT.md`](./PRODUCT-AUDIT.md). Jury summary: [`COMPETITION-NARRATIVE.md`](./COMPETITION-NARRATIVE.md)._
