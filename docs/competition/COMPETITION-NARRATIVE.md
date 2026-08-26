# Kondo — the two-page version

## Your student life in China, in one place.

**Study. Live. Connect. Discover.**

_Everything here is supported by [`PRODUCT-AUDIT.md`](./PRODUCT-AUDIT.md) and
expanded in [`KONDO-DOSSIER.md`](./KONDO-DOSSIER.md)._

---

## Where it started

Kondo did not begin as an idea for a student app. It began with money.

An international student's support is usually in one country and their expenses
are in another. Tuition has to be paid in China, from home. That transfer — the
rails, the currency, the fees, the timing — is the first serious obstacle many
students meet, and it arrives before they do.

Studying that problem is what made the project bigger. Money turned out not to be
a category but a **moment** — the first in a long sequence that lands on the same
person. The student who cannot easily pay tuition is the same student who, three
weeks later, cannot find the right building, does not know which bank branch
handles foreign passports, and has not met anyone from home yet.

> **On payments, stated exactly:** Kondo does not process payments, hold funds or
> convert currency, and makes no regulatory claim. Any future version would need
> licensed, authorised partners. The product says so itself: its payment page
> reads _"Payments are not active yet."_

---

## The problem

An international student does not only need a university. They need to know how
the place works.

**This is not a criticism of China.** China has one of the most advanced digital
and service ecosystems in the world — payments, delivery, transport, commerce and
campus administration are solved here, better than in most places a student
arrives from.

The difficulty is narrower: **those services assume local knowledge a newly
arrived student has not acquired yet.** The knowledge exists — it is simply spread
across WeChat groups, seniors, notice boards and a dozen apps built for people who
already know how the system works.

The gap is in orientation, not infrastructure. It is temporary but expensive: it
costs a student their first months, and it costs the city around them an
international community it cannot currently reach.

**Kondo is not a replacement for China's ecosystem. It is a way in.**

---

## What a student actually gets

One account, covering the parts of student life that are currently scattered.

**Study.** Workspace opens on today's real timetable — _"3 classes today,
Engineering Physics II, 08:30–10:05, B204."_ The class opens its materials. The
textbook opens where you stopped, at the exact sentence, not a page number. Hold a
passage and four actions appear: **Highlight · Note · Task · AI**. Choose Task and
the passage becomes a planner item, quoted, linked back to where it came from.

> **Your books, notes, courses and tasks in one workspace — and the passage you
> were reading is the thing that becomes the task.**

**Adapt.** Fifteen practical guides that begin before the flight: the first 72
hours, university registration, a Chinese bank account, a SIM card, WeChat and
Alipay, the residence permit, healthcare, emergencies. Each one a checklist that
remembers your progress.

**Connect.** Communities organised the way students actually cluster — by origin,
university, situation. Meet, Nearby and Looking For. Messaging. Student Story: a
vertical video feed where students show the city to each other.

**Live.** A marketplace where a graduating student sells their bicycle to an
arriving one, with the conversation attached to the listing and kept out of their
personal inbox.

This is not a plan. **198 page routes, 283 API routes, 142 database models, 1,023
automated tests and 128 browser journeys, green in CI.**

---

## The turn

A student opens Food & Services to find lunch:

> _Student lunch set · CN¥18 · Jiaxing · Nanhu Kitchen · VERIFIED_
> _Jiaxing zongzi set · CN¥36 · Jiaxing · Nanhu Kitchen · VERIFIED_

Every item on that screen was published by a business in Jiaxing, from a business
account, into a surface international students browse for lunch.

**The student side and the city side are the same screen.**

That is the whole argument. Kondo spends nine tenths of its effort earning a
student's daily attention — timetable, textbook, notes, friends, bicycle, lunch.
That attention creates something that did not exist before: a place where
international students in Jiaxing can be reached.

|                                |                                                                      |
| ------------------------------ | -------------------------------------------------------------------- |
| **Students need**              | trusted local discovery                                              |
| **Jiaxing organizations need** | visibility with an audience that is nearby and currently unreachable |

A restaurant near campus does not need a marketing strategy for international
students. It needs **one channel where those students already are.**

> **The student side earns the audience. The city side reaches it.**
> Neither half works alone. A student directory is a directory. A business listing
> site is a listing site. The exchange is the product.

---

## What the business side already is

An organization in Kondo is a separate kind of account: its own workspace, team
roles, and **capabilities granted one at a time** — `PRODUCTS`,
`STUDENT_SERVICES`, `INTERNSHIPS_JOBS`, `EVENTS`, `HOUSING`, `SCHOLARSHIPS`.

That last part is what makes it governable: **a restaurant can publish food
without being able to publish job offers.** There is an identity-verification
pipeline behind it, and a verified storefront carries an honest label — Kondo
verifies who an organization is, never how good it is.

**Built and working. Never used by a real business.**

**Next phase, not built:** a Jiaxing company publishing an _International Students
Open Day_ — students discover it, request a place, visit the site, and see what
the city actually makes. Kondo already has organizations, events and an
apply-and-review pipeline. What is missing is the surface and one willing company.

---

## Why Jiaxing

- **Six universities**, already in Kondo's reference data
- **Concentrated** — small enough to reach, large enough to matter
- **Reachable businesses** — restaurants near campus can be onboarded by walking in
- **A real economic identity** to show students: textiles, photovoltaic glass,
  advanced materials, cross-border digital trade
- **Between Shanghai and Hangzhou**, in the Yangtze River Delta
- **Measurable** — one city means adoption can be observed, not estimated

And Jiaxing is not hypothetical inside the product. **`/explore/jiaxing` already
exists and is the only city hub in Kondo.** It is titled _"Jiaxing, open by
design."_ and its own summary names the model: **"Kondo bridge: Students ↔ city
opportunity."**

> **Said plainly:** the company entries in that hub are editorial, researched from
> public sources and marked _"Future company profile ready."_ **No Jiaxing company
> has been contacted, onboarded or partnered with.** The hub is built to receive
> real accounts. It does not hold any.

The pilot is not a pivot. Jiaxing is already the product's centre of gravity.

---

## Business model, staged by trust

**Today: no revenue, no paying customers, no users. Payments are simulated.**

1. **Free for students, always** — the student side is the audience; charging it
   destroys what makes the city side valuable
2. **Organization subscriptions** — verified storefront, catalogue, analytics
3. **Promoted placement** — clearly labelled, never disguised as organic
4. **Opportunity posting**
5. **Institutional partnerships**

Transaction commission is deliberately not first: it needs infrastructure Kondo
does not have and trust Kondo has not earned.

---

## Competitive position

WeChat, Xiaohongshu, Taobao, Meituan and university groups are excellent, and
Kondo does not compete with them.

What none of them provides is a **single context for being an international
student in one Chinese city** — where your timetable, your textbook, your
residence-permit checklist, your community, the restaurant near campus and an
internship at a local company are the same product, in a language you read, from
before you arrive.

**The differentiation is context, not features.**

---

## What we are asking to prove

> **Will international students in Jiaxing use one place for their student life —
> and will that make them findable by the city around them?**

One semester, one city. Measurable: registered students, weekly active use,
timetables in Workspace, guides completed, businesses onboarded, products
published, storefront views, student→business conversations, opportunities
published.

**All targets. Kondo has no users today, and this document says so.**

---

## The three facts that never move

> **No users. No revenue. No partnerships. No institutional endorsement.**
> **No AI answer has ever been produced** — the integration is real, the API key is
> not configured, and the product fails honestly: _"Ask AI is not configured on
> this environment. Highlights and notes still work."_
> **No real payment has ever been processed.**

The product is built. The question that remains is not a technical one — and one
semester in one city can answer it.
