# Kondo

## Your student life in China, in one place.

**Study. Live. Connect. Discover.**

_Source document for the entrepreneurship and innovation competition — Jiaxing,
Zhejiang. Written from the product as it exists on 26 August 2026, commit
`324a7ec`. Every screenshot in `./screenshots/` is of the running application._

---

### How to read the labels

Every claim in this document carries one of four labels. They are used strictly,
because a jury deserves to know which parts are real.

| Label                | Meaning                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **LIVE NOW**         | Built, covered by tests, and demonstrated in a browser. There is a screenshot.                                         |
| **IN TESTING**       | Built and usable, but never used by a real student — or blocked on a credential or on content that does not exist yet. |
| **NEXT PHASE**       | Designed and argued for. Not built. No code.                                                                           |
| **LONG-TERM VISION** | A direction, not a plan. Nothing exists.                                                                               |

Three facts that never move, and are repeated wherever they matter:

> **Kondo has no users, no revenue, no paying customers, no partnerships and no
> institutional endorsement.** Every number in the pilot section is a target.

---

## 01 — An international student does not only need a university

A student is admitted to a university in China. The admission is the easy part.

What arrives with it is a second, unwritten syllabus. Before departure: which
apps matter, how the digital day actually works, what the university expects,
what to prepare, and — the question underneath all of them — how to pay for any
of it from home. After arrival: registration, classes, textbooks, timetables,
assignments, where to eat, where to buy a desk, how to get a phone number, how
to open a bank account, where the other students from home are, what to do on a
Sunday, and how to find anything at all in a city you have never seen.

**None of this is a criticism of China.** China has one of the most advanced
digital and service ecosystems in the world. Payments, delivery, transport,
commerce and campus administration are solved problems here — comprehensively,
and better than in most places a student would be arriving from.

The difficulty is narrower and more human than that. **Those services assume
local knowledge that a newly arrived international student has not acquired
yet.** The knowledge exists — it is simply distributed across WeChat groups,
seniors, notice boards, half-remembered advice, and a dozen applications built
for people who already know how the system works.

So the gap is not a gap in the ecosystem. It is a gap in **orientation**, and it
is temporary but expensive. It costs a student their first months. It costs a
city the engagement of international students already living in it. And it costs
local businesses an audience that is physically nearby and commercially
invisible to them.

**Kondo is not a replacement for China's digital ecosystem. It is a way in.**

---

## 02 — Where Kondo actually started: money

Kondo did not begin as an idea for a student social network. It began with a
specific, unglamorous problem.

An international student's money is usually in one country and their expenses
are in another. Tuition, university fees and the cost of the first months have
to be paid in China, from support that originates at home. That transfer — the
rails, the currency, the fees, the timing, the paperwork — is the first serious
obstacle many students meet, and it arrives before they do.

The original concept was to make that specific moment easier: for a student to
settle university tuition and selected student expenses without the process
being the hardest part of arriving.

### Stated exactly

**LONG-TERM VISION.** Kondo does not process payments. It does not hold funds,
convert currency, or move money across borders. It is not a bank, a payment
institution or a money-services business, and it makes no claim about what would
be permitted.

Any future version of this would require **licensed and authorised payment
partners** and the regulatory approvals that come with them. Kondo has neither.

This is not a caveat added for the jury — **it is what the product itself says.**
Kondo has a payment-readiness page, and it reads:

> **"Payments are not active yet."**
> "Kondo payments require an authorized payment partner. No provider is
> configured yet, so payment and currency conversion are unavailable."
> **No custody** — "Kondo will not hold funds, exchange currency or claim to be a
> bank."
> **Authorized partners** — "A configured provider must handle KYC, compliance,
> FX, settlement and refunds."

📷 `03-payments-not-active.png`

The checkout that does exist inside Kondo — for study materials — runs on a
`SIMULATED` provider. **No real payment has ever been processed.** `ALIPAY`,
`WECHAT_PAY` and `CARD` exist in the schema so that adding an authorised
provider is an adapter, not a rebuild. That is an engineering fact, not a
regulatory one.

The point of this section is what it says about the origin: **Kondo started from
a real problem experienced by real students, not from a wish to build another
app.**

---

## 03 — From one problem to the whole journey

Studying the payment problem is what made the project bigger.

Money turned out not to be a category. It was a **moment** — an early one, in a
sequence that keeps going long after the transfer clears. The student who cannot
easily pay tuition is the same student who, three weeks later, cannot find the
right building, does not know which bank branch handles foreign passports, has
no idea where to buy a desk, and has not met anyone from their own country yet.

```
PAY      →  the problem we started from
PREPARE  →  before you fly
ARRIVE   →  the first 72 hours
STUDY    →  classes, books, notes, tasks
LIVE     →  food, things, services, the city
CONNECT  →  people, communities, conversations
GROW     →  opportunities, organizations, what comes after
```

Support is needed **from before arrival until graduation** — and the same person
needs all of it. That is Kondo.

---

## 04 — What Kondo is

> **Kondo is a digital companion for international students in China.** It brings
> together the tools, information, communities, local services and opportunities
> a student needs before arriving and throughout their studies — and, in doing
> so, creates a direct channel between those students and the universities,
> organizations, businesses and services of the city they live in, starting with
> Jiaxing.

Five pillars, not twenty-five features.

|              |                                               |            |
| ------------ | --------------------------------------------- | ---------- |
| **STUDY**    | Classes, textbooks, notes, tasks              | LIVE NOW   |
| **LIVE**     | Food, things, services, daily life            | LIVE NOW   |
| **CONNECT**  | People, communities, conversations            | LIVE NOW   |
| **DISCOVER** | The city, its businesses, what is around you  | LIVE NOW   |
| **GROW**     | Opportunities, organizations, what comes next | IN TESTING |

📷 `01-landing.png` · `02-home.png`

---

## 05 — Before you arrive, and the first week after

**LIVE NOW.**

Kondo opens before the plane does. The Guide is a set of 15 practical walkthroughs
written for someone who has not landed yet: what to do in the first 72 hours,
university registration and the student ID, opening a Chinese bank account,
getting a SIM card and mobile data, setting up WeChat and Alipay, applying for a
residence permit, the airport-to-campus route, trains and 12306, healthcare, and
emergency contacts.

A guide is not an article. It is a checklist that remembers where you are:

> **Set up Alipay and link a foreign card** — MONEY · 20 minutes · progress 0/4
> _"Alipay is the most useful payment app for a new student in China. Many
> foreign cards work, but card acceptance changes; set up and test before you
> arrive."_

📷 `16-guide.png` · `17-guide-alipay.png`

The framing matters and is deliberate. Kondo does not tell students that China is
difficult. It tells them **how the system works**, so that a powerful ecosystem
becomes usable in week one instead of month four.

---

## 06 — Your campus, in your pocket

This is the heart of the product, and the part that is most often
under-explained.

### What if a student only needed their phone for class?

It is 08:00. A student leaves their residence. No textbook. No notebook. No
folder of printouts.

**08:30 — they open Kondo.**

> **WEDNESDAY**
> **3 classes today**
> Engineering Physics II — 08:30–10:05 · B204
> Chinese Language (HSK 4) — 10:25–12:00 · A118
> Linear Algebra — 14:00–15:35 · C301

Workspace does not ask what today is. It reads the student's real timetable and
puts today at the top.

📷 `05-workspace-today.png` — **LIVE NOW**

**08:31 — they open the class.**

The course opens with its room, its time, its teacher, its materials, and a
button to add to it — a photo of the whiteboard, a document, a voice note, a
task.

📷 `06-workspace-course.png` — **LIVE NOW**

**08:32 — they open the textbook.**

It opens where they stopped yesterday. Not at the beginning, and not at a page
number — at the exact sentence, because Kondo stores a canonical fragment
identifier rather than a page. The position survives a change of font size, a
change of device, and a reinstall.

📷 `07-library.png` · `08-reader.png` — **LIVE NOW**

**09:05 — the teacher explains something that matters.**

The student holds a finger on the passage. Four actions appear over the text:

> **Highlight · Note · Task · AI**

📷 `09-reader-selection.png` — **LIVE NOW**

**They choose Task.**

> **ADD A TASK** — _Goes to your planner · Why positions are not page numbers_
> ❝An EPUB reflows. The number of pages in a book depends on the size of the
> screen and the size of the type.❞
> Title: `Re-read Why positions are not page numbers` · Due (optional)

📷 `10-reader-task.png` — **LIVE NOW**

**They also ask about it.**

> **Ask Kondo AI** — with the selected passage carried in
> `Explain this` · `Translate` · `Explain simply` · `Why does this matter?`

📷 `11-reader-ask-ai.png`

### And here is where this document refuses to overclaim

**IN TESTING.** The Ask AI feature is real code calling a real provider. It is
not connected to an API key in the environment these screenshots were taken in,
so **no AI answer has ever been produced, and this document does not claim one.**
What it does instead is fail honestly, in the student's language:

> _"Ask AI is not configured on this environment. Highlights and notes still
> work."_

📷 `12-reader-ai-not-configured.png`

That screenshot is in this document on purpose. A jury should be able to tell the
difference between what runs and what is wired.

**Later that day.**

Every highlight, note and task is in one place, each one linked back to the exact
passage it came from, and the ones that became tasks are marked _"in your
planner."_

📷 `13-reader-notes.png` — **LIVE NOW**

And the planner already has it:

> **Your academic day, organized** — Today · Schedule · Tasks
> Import · Course · Task · Current class · Next class

📷 `14-planner.png` — **LIVE NOW**

### The value proposition, in one line

> **Your books, notes, courses and tasks in one student workspace — and the
> passage you were reading is the thing that becomes the task.**

### One more, honestly labelled

**IN TESTING.** Kondo can build a timetable from a photo or PDF of a university
schedule, using a document-understanding model. The screen exists, the pipeline
exists, the schema exists. In this environment it reports **"No import yet"**
because no provider credential is configured. The schedule behind every Workspace
screenshot above was entered through Kondo's own timetable API, not imported.

📷 `15-timetable-import.png`

---

## 07 — Arriving somewhere means rebuilding your people

**LIVE NOW.**

Moving countries resets a social network to zero. Not the friendships — the
proximity. The person who can tell you which office is open before 4 PM is
suddenly not in the room.

Kondo's community layer is built around that specific problem rather than around
engagement. Communities are organised the way students actually cluster — by
origin, by university, by situation, by interest:

> African Students in Beijing · Ghanaians in China · Pakistanis in China ·
> Kazakhstanis in China · New to China · Housing & Roommates · Tsinghua
> Community · Tech Builders

Each has a feed, posts, threaded replies, reactions, members, guidelines and
moderation. Alongside them, **Meet**, **Nearby** and **Looking For** help a
student find people by real distance from their city coordinates — km, not a map,
and only for students who chose to be discoverable.

📷 `18-communities.png` · `19-community.png` · `33-messages.png`

**IN TESTING.** Meet includes video calling, wired to a real provider. **No
credentials are configured, so video cannot be demonstrated** and is not claimed.

---

## 08 — Student Story: the city, told by students

**LIVE NOW.**

A vertical video feed, built for the way students already share. Muted autoplay
as you scroll, one video playing at a time, a creator can delete their own reel,
and there is a data-saver mode for students on a metered plan.

> **My first hour in China 🇨🇳** — ARRIVALS
> _"A calm first look at arrival day as an international student."_ — Nana Owusu

📷 `20-student-stories.png`

The strategic point is easy to miss. Student Story is not a social feature bolted
on — **it is the first place where Kondo stops being a tool and starts being a
discovery layer.** A student films the noodle shop near the west gate. Forty other
international students now know it exists.

Nobody advertised. That is the mechanism the second half of this document is
built on.

---

## 09 — Daily life: the things students actually need

**LIVE NOW.**

A student is graduating and owns a bicycle. Throwing it away is absurd; selling
it to a stranger is a hassle.

> **Giant Escape city bicycle** — ¥680 · Negotiable · Beijing
> _"Well-maintained, recently serviced, and perfect for campus. Includes lock and
> front light."_

📷 `21-marketplace.png` · `22-listing.png`

They publish it. Another student finds it — by category, city, price, or search.
They tap **Chat with seller**, and the conversation opens **with the bicycle
attached to it**:

> Kwame Nkrumah · Seller · Marketplace
> ❝Giant Escape city bicycle · ¥680 · Negotiable · Beijing❞
> — "Hi! Is the bicycle still available? I'm on campus and could pick it up this
> week."
> — "Yes, still available. I'm free Friday afternoon near the west gate."

📷 `23-listing-chat.png` · `24-listing-inbox.png`

That conversation was really sent, between two accounts, in the running
application. Two design decisions in it are worth a jury's attention:

1. **Marketplace conversations do not mix into ordinary Messages.** They have
   their own inbox, and every thread carries the listing it is about. A student's
   personal conversations stay personal.
2. **One listing, one thread.** Duplicate threads are prevented at the database
   level, not by hoping the interface behaves.

Kondo does not take payment and does not hold the goods. Students arrange the
exchange themselves. **That is a deliberate limit, not a missing feature** — see
§17.

---

## 10 — Discovering the city — and the turn in the story

**LIVE NOW.**

The same student needs lunch, a haircut, a printer, a phone repair, a place to
take visiting parents.

> **Food & Services**
> _"Restaurants, shops and professional services published by organizations on
> Kondo. Every listing below is published by a registered organization, not by an
> individual student."_
>
> Student lunch set — CN¥18 · Jiaxing · Nanhu Kitchen · PRODUCT · VERIFIED
> Hand-pulled noodles — CN¥22 · Jiaxing · Nanhu Kitchen · PRODUCT · VERIFIED
> Jiaxing zongzi set — CN¥36 · Jiaxing · Nanhu Kitchen · PRODUCT · VERIFIED
> Catering for student events — Contact for price · Jiaxing · SERVICE · VERIFIED

📷 `25-food-and-services.png` · `28-product.png`

Read that screen again and notice what just happened.

Every item on it was published by **a business in Jiaxing**, from a business
account, into a surface that international students browse for lunch.

**The student side and the city side are the same screen.**

---

## 11 — When students discover Jiaxing, Jiaxing discovers them

This is the hinge of the whole project.

Kondo spent nine sections earning a student's daily attention: their timetable,
their textbook, their notes, their friends, their bicycle, their lunch. That
attention is the asset. And it creates something that did not exist before.

|                                 |                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| **International students need** | trusted local discovery — where to eat, what to buy, who to call, what is worth their time    |
| **Jiaxing organizations need**  | visibility with an international audience that is physically nearby and currently unreachable |

A restaurant near campus does not need a marketing strategy for international
students. It needs **one channel where those students already are.**

> **The student side earns the audience. The city side reaches it.**
> Neither half works alone. A student directory is a directory. A business listing
> site is a listing site. **The exchange is the product.**

---

## 12 — Kondo for Jiaxing organizations

**LIVE NOW** — the capability. **IN TESTING** — because no real Jiaxing business
has been onboarded yet.

An organization is not a profile page in Kondo. It is a separate kind of account,
with its own workspace, its own team, and its own permissions.

**Types:** company · university · education agency · housing provider · student
association · embassy or consulate · recruitment organization · service provider

**Team roles:** owner · admin · manager · member · editor · viewer

**Capabilities**, granted one by one: `PRODUCTS` · `STUDENT_SERVICES` ·
`INTERNSHIPS_JOBS` · `EVENTS` · `HOUSING` · `SCHOLARSHIPS` ·
`UNIVERSITY_INFORMATION`

That last row is the mechanism that makes the whole thing governable. **A
restaurant can be allowed to publish food without being allowed to publish job
offers.** A capability must be explicitly enabled before the matching surface will
publish anything.

And there is a verification pipeline behind it, with documents and a review
queue. A verified organization carries this on its public page:

> **Verified organization** — _"Kondo reviewed information supporting this
> organization's identity. This does not guarantee every external service or
> claim."_

📷 `26-org-storefront.png` · `27-org-products.png`

That wording is chosen carefully. Kondo verifies **identity**, not quality. It
does not tell a student a restaurant is good.

---

## 13 — A Jiaxing restaurant, step by step

```
Nanhu Kitchen — Jiaxing, Zhejiang
  │
  ├── creates an organization account                        LIVE NOW
  ├── is verified by Kondo (identity, documents, review)     LIVE NOW
  ├── is granted the PRODUCTS + STUDENT_SERVICES capability  LIVE NOW
  ├── publishes dishes with photos and prices                LIVE NOW
  │     Student lunch set · CN¥18
  │     Hand-pulled noodles · CN¥22
  │     Jiaxing zongzi set · CN¥36
  ├── publishes a service                                    LIVE NOW
  │     Catering for student events · Contact for price
  ├── gets a public storefront students can open and share   LIVE NOW
  └── receives student enquiries                             LIVE NOW
```

📷 `26-org-storefront.png` · `28-product.png`

A student browsing Food & Services sees the dish, opens the product, and taps
**Ask organization**.

**What Kondo does not do:** no ordering, no delivery, no payment, no table
booking. The student walks in, or messages. Claiming otherwise would be false.

---

## 14 — A Jiaxing company, step by step

```
A Jiaxing manufacturer
  │
  ├── creates an organization account                        LIVE NOW
  ├── builds a public company profile                        LIVE NOW
  ├── publishes products and activity areas                  LIVE NOW
  ├── tells its story — what it makes, and for whom          LIVE NOW
  ├── enables INTERNSHIPS_JOBS and publishes an opportunity   IN TESTING
  ├── reviews student applications in its workspace           IN TESTING
  ├── publishes an "International Students Open Day"          NEXT PHASE
  └── hosts students on site                                  NEXT PHASE
```

**IN TESTING, precisely.** The opportunity pipeline is complete — an organization
publishes, a student applies, the organization reviews applicants, reminders and
expiry run on a schedule. **There are zero opportunities in the database**, so it
has never been exercised with real content. The screen shows the honest empty
state:

> _"No opportunities match this search yet."_

📷 `30-opportunities-empty.png`

**On student employment, this document says nothing.** What an international
student on a study visa may legally do in terms of work, internships or paid
activity is a matter for Chinese regulation and the university's international
office. Kondo makes no claim about it, and the pitch should not either.

---

## 15 — Next phase: bringing students inside Jiaxing companies

**NEXT PHASE. None of this is built.**

Kondo already has organizations, an events capability, and a
publish-apply-review pipeline. The proposal is to point them at something more
interesting than a job board.

**Company visits.** A Jiaxing manufacturer publishes an _International Students
Open Day_. Students discover it in Kondo, request a place, visit the site, and see
what the company actually makes — the materials, the process, the scale.

**Company presentations.** A company introduces itself properly: what it
produces, the technology behind it, its history, where in the world its products
go.

**Why this is worth building.** International students in Jiaxing today can
complete an entire degree without ever learning that the city is a serious centre
for polyester and technical textiles, photovoltaic glass, advanced materials and
cross-border digital trade. Not through anyone's fault — nothing connects the
campus to the industrial park.

This is the cheapest, most concrete thing a Jiaxing pilot could test. The
capability exists; what is missing is the surface and one willing company.

---

## 16 — Student today, international connection tomorrow

**LONG-TERM VISION. Not measured, not claimed, not promised.**

International students leave. That is not a failure of the model — it is the most
interesting thing about it.

A student who spends four years in Jiaxing goes home and becomes an engineer, a
founder, a researcher, a manager, an importer. Whether Jiaxing means anything to
them afterwards depends almost entirely on whether they ever encountered it as
more than a place their university happened to be.

```
A student discovers a Jiaxing company inside Kondo
        ↓
visits it, sees what it makes
        ↓
graduates, goes home, builds a career
        ↓
Jiaxing is a place they know something real about
```

**This is a hypothesis.** No such outcome has been observed, measured, or caused
by Kondo, and there is no evidence it would happen. It is offered as a reason the
pilot is worth running, not as a result.

---

## 17 — Why Jiaxing

Only now, having explained the product, does the city become the argument.

Kondo does not need to launch across China. It needs one city where the
environment is understandable, the students are reachable, and the businesses can
be met in person.

- **Six universities**, already in Kondo's reference data: Jiaxing University,
  Jiaxing Nanhu College, Zhejiang University of Finance & Economics Dongfang
  College, Tongji Zhejiang College, Jiaxing Vocational & Technical College,
  Jiaxing Nanyang Vocational & Technical College
- **Concentrated** — small enough to reach, large enough to matter
- **Reachable businesses** — restaurants and services near campus can be onboarded
  by walking in
- **A real economic identity** to show students: textiles, photovoltaic glass,
  advanced materials, cross-border digital trade
- **Between Shanghai and Hangzhou**, in the Yangtze River Delta
- **Measurable** — one city means adoption can be observed rather than estimated

### And Jiaxing is already in the product

**LIVE NOW.** `/explore/jiaxing` exists, and **Jiaxing is the only city in Kondo
with a hub of its own.** It is titled _"Jiaxing, open by design."_ and its own
summary card already names the model:

> **Kondo bridge: Students ↔ city opportunity**

It covers local companies, local products, universities, jobs and internships,
local events, city services, and an introduction to the city.

📷 `31-jiaxing-hub.png` · `32-jiaxing-companies.png`

> **Said plainly, because it matters.** The company entries in that hub are
> **editorial** — researched from public sources, each citing an official source
> URL, and each marked **"Future company profile ready."** They are not platform
> accounts. **No Jiaxing company has been contacted, onboarded or partnered with.**
> The hub is built to receive real organization accounts. It does not hold any.

The pilot is therefore not a pivot. **Jiaxing is already the product's centre of
gravity.**

```
Jiaxing  →  other Zhejiang university cities  →  other Chinese university cities
```

Cities in Kondo are data, not code. That is an engineering claim, and it is true.
It is not a promise about expansion.

---

## 18 — The two-sided ecosystem

```
   INTERNATIONAL STUDENTS                              JIAXING

   need                                             provides
   ├── study tools                                  ├── universities
   ├── orientation                                  ├── restaurants
   ├── community                                    ├── shops and services
   ├── food and services                            ├── organizations
   ├── things for daily life                        ├── companies
   ├── local discovery                              ├── opportunities
   └── opportunities                                └── city experiences

              ╲                                    ╱
               ╲                                  ╱
                ╲            KONDO               ╱
                 ╲     the orientation layer    ╱
                  ╲                            ╱

   students receive                            Jiaxing receives
   ├── convenience                             ├── visibility
   ├── information                             ├── engagement
   ├── tools                                   ├── an international audience
   ├── community                               ├── student connection
   ├── discovery                               ├── feedback
   └── opportunities                           └── long-term exposure

   students give                               Jiaxing gives
   ├── attention                               ├── products and services
   ├── spending                                ├── opportunities
   ├── feedback                                ├── local knowledge
   └── presence                                └── access
```

---

## 19 — What actually exists today

Scale, measured from the repository:

|                          |           |
| ------------------------ | --------- |
| Page routes              | 198       |
| API routes               | 283       |
| Database models          | 142       |
| Database enums           | 144       |
| Applied migrations       | 75        |
| Automated tests passing  | **1,023** |
| Browser journeys passing | **128**   |

CI runs formatting, lint, typecheck, the full test suite, a production build, all
128 browser journeys and a production dependency audit on every push. **It is
green on `main`.**

### Honest status of every module

**LIVE NOW** — demonstrated in a browser, with a screenshot in this document:
Home · Onboarding · Registration · Student Hub · Workspace · Planner · Study
Essentials · Digital library · EPUB reader with highlights, notes and
passage-to-task · Guide (15 guides) · Communities · Meet / Nearby / Looking For
(text) · Student Story · Marketplace · Listing-scoped marketplace messaging ·
Food & Services · Organizations, storefronts and catalogues · Messaging ·
Notifications · Discover · Jiaxing city hub · Profiles and settings · Admin
console (48 pages)

**IN TESTING** — built, but unproven, un-keyed, or empty:

| Module                        | Why it is not "live"                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| Ask Kondo AI                  | Real provider integration. No API key configured. **No AI answer has ever been produced.** |
| AI timetable import           | Same. Screen reports "No import yet".                                                      |
| Opportunities                 | Complete pipeline. **Zero opportunities in the database.**                                 |
| Housing                       | Listings, search, roommates, requests. **Zero listings.**                                  |
| Meet video calling            | Wired to a real provider. **No credentials.**                                              |
| Payments                      | `SIMULATED` only. **No real payment ever processed.**                                      |
| Scholarships                  | Real listings and agent directory. Content is thin.                                        |
| Every organization capability | Built and working. **No real business has ever used it.**                                  |

**NEXT PHASE** — not built: company visits and open days · student–company events
· a Chinese-language interface (the app is English only today, and the settings
page says so)

**LONG-TERM VISION** — nothing exists: cross-border tuition payment · the
alumni/international bridge · expansion beyond Jiaxing

### Reference data — a genuine asset

|                             |       |
| --------------------------- | ----- |
| Countries                   | 242   |
| Cities                      | 346   |
| Chinese universities        | 2,952 |
| Cities in Zhejiang          | 11    |
| **Universities in Jiaxing** | **6** |

Jiaxing is present with coordinates (30.7522, 120.75), province Zhejiang, and all
six institutions.

---

## 20 — Business model

Only now, and staged by trust cost rather than by revenue size.

**Today: no revenue. No paying customers. No users. Payments are simulated.**

1. **Free for students. Always.** The student side is the audience; charging it
   destroys the thing that makes the city side valuable. This is a structural
   decision, not a launch promotion.
2. **Organization subscriptions** — a Jiaxing business pays for a verified
   storefront, a catalogue and analytics.
3. **Promoted placement** — clearly labelled as promoted, never disguised as
   organic. A student who cannot trust what they see stops looking.
4. **Opportunity posting** — companies pay to reach international students.
5. **Institutional partnerships** — universities and city bodies funding
   orientation content.

**Transaction commission is deliberately not first.** It needs payment
infrastructure Kondo does not have and a trust position Kondo has not earned.

---

## 21 — The pilot

One semester, one city, one question:

> **Will international students use a single platform for study and city life —
> and does that make them reachable by Jiaxing businesses?**

```
1  International students at one Jiaxing university
      Prove the student side is worth opening weekly.
2  International students across Jiaxing's six institutions
      Reach the density at which community and marketplace start working.
3  Local restaurants and services
      Prove a business will publish, and will answer a student.
4  Selected Jiaxing companies
      Prove opportunity flow works in both directions.
5  A second Chinese university city
      Prove the model is not Jiaxing-specific.
```

### Targets, not results

**Kondo has no users. Every number below is a target for a one-semester pilot.**

| Student side                           | Target |
| -------------------------------------- | ------ |
| Registered students                    | 300    |
| Weekly active students                 | 120    |
| Students with a timetable in Workspace | 90     |
| Guides completed                       | 500    |
| Marketplace listings published         | 150    |

| Business side                       | Target |
| ----------------------------------- | ------ |
| Verified organizations onboarded    | 20     |
| Products and services published     | 120    |
| Storefront views                    | 3,000  |
| Student→business conversations      | 200    |
| Companies publishing an opportunity | 5      |

---

## 22 — Competitive position

WeChat, Xiaohongshu, Taobao, Meituan and university groups are excellent, and
Kondo does not compete with any of them. It would lose.

What none of them provides is a **single context for being an international
student in one Chinese city** — where your class schedule, your textbook, your
residence-permit checklist, your community, the restaurant near campus and an
internship at a local company are the same product, in a language you read, from
before you arrive.

**Kondo's differentiation is context, not features:** international-student
framing, pre-arrival onboarding, and a local business layer no general platform
has a reason to build for this audience.

---

## 23 — Risk, safety and what we do not know

**Built in:** identity verification for organizations · moderation and reporting
across every social surface · blocking and archiving in messaging · media
scanning before delivery · granular privacy settings · audit logging · a 48-page
admin console.

**Deliberate limits:** Kondo does not hold money, does not verify quality (only
identity), does not offer legal or immigration advice, and labels promoted
content as promoted.

**Open questions that a jury may ask and that only a human can answer:**

1. **Is the platform live in production?** The code is on GitHub and CI is green.
   Deployment status was not verified.
2. **Real user numbers.** None exist in the repository. This document says zero.
3. **Jiaxing company facts.** The city hub cites public sources. Verify before
   presenting.
4. **Student employment law.** Confirm with the university's international office
   before any opportunity claim is made aloud.
5. **University relationship.** No endorsement, agreement or contact exists in the
   codebase.
6. **Copyright for the digital library.** The pilot book is a Kondo-authored
   sample. A real catalogue needs cleared rights.
7. **Data protection.** PIPL applicability and data-residency requirements have
   not been assessed.
8. **Is "Kondo" registered** as a name or trademark in China?
9. **Payment regulation.** Any future payment layer needs licensed partners and
   approvals that have not been sought.

---

## 24 — Roadmap

| Horizon             | What                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| **Now**             | Configure the AI provider. Onboard the first Jiaxing restaurants. Publish the first real opportunity.     |
| **Pilot semester**  | 300 students at one university. 20 verified Jiaxing organizations. Measure everything in §21.             |
| **After the pilot** | Chinese-language interface. Company visits and open days. A second Zhejiang city.                         |
| **Long term**       | An authorised payment partner, if the regulatory path is real. Alumni and international-connection layer. |

---

## 25 — In closing

Kondo began with a student who could not easily pay their tuition from home. It
grew into the observation that the payment was only the first of a hundred small
frictions, all of which land on the same person, none of which any single service
was built to solve together.

What exists today is a working product: 198 routes, 1,023 tests, 128 browser
journeys, an academic workspace that opens the right book at the right sentence,
a community layer, a marketplace, and a business layer with a Jiaxing restaurant
already publishing food that Jiaxing students can find.

What does not exist is equally clear, and is written on every page of this
document: **no users, no revenue, no partnerships, no institutional endorsement,
no working AI answer, no real payment, no onboarded company.**

The competition asks whether this is worth building. The honest answer is that the
product is built and the question that remains is not technical:

> **Will international students in Jiaxing use one place for their student life —
> and will that make them findable by the city around them?**

That is a question one semester in one city can answer. Everything above exists
to make asking it cheap.

---

_Evidence for every claim: [`PRODUCT-AUDIT.md`](./PRODUCT-AUDIT.md).
Two-page version: [`COMPETITION-NARRATIVE.md`](./COMPETITION-NARRATIVE.md).
Screenshots: [`./screenshots/`](./screenshots/)._
