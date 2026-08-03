/**
 * Seeds the Study Essentials catalogue with a realistic demo assortment.
 *
 * Idempotent: every entry is upserted on its slug, so running it twice leaves
 * the catalogue unchanged. Orders are never touched.
 *
 *   npm run essentials:seed
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

type Seed = Omit<Prisma.StudyEssentialCreateInput, "publishedAt">;

const CATALOGUE: Seed[] = [
  // --- Kondo digital -------------------------------------------------------
  {
    slug: "hsk-complete-preparation-guide",
    title: "HSK Complete Preparation Guide",
    shortDescription:
      "Every HSK level in one plan, with vocabulary drills, mock papers and a week-by-week revision schedule.",
    description:
      "A complete preparation path from HSK 1 to HSK 6, written with students who arrived in China without prior Chinese. Each level opens with a diagnostic, then a six-week plan covering vocabulary, grammar patterns, listening and the written paper. Includes four full mock examinations per level with worked answers, and a printable revision tracker you can keep beside your timetable.",
    category: "Language",
    format: "DIGITAL",
    source: "KONDO",
    status: "PUBLISHED",
    priceMinor: 8900,
    currency: "CNY",
    coverEmoji: "🀄",
    highlights: [
      "HSK 1 to 6 in one guide",
      "24 mock papers with worked answers",
      "Printable six-week revision tracker",
    ],
    sortOrder: 10,
  },
  {
    slug: "chinese-university-survival-handbook",
    title: "Chinese University Survival Handbook",
    shortDescription:
      "Registration, residence permits, campus systems and the paperwork nobody explains before you land.",
    description:
      "The handbook covers your first year end to end: campus registration, the residence permit window, opening a bank account, the health check, using the campus intranet, and how course selection actually works. Written from the experience of international students across Beijing, Shanghai, Hangzhou and Jiaxing, with the deadlines that catch people out marked clearly.",
    category: "Student life",
    format: "DIGITAL",
    source: "KONDO",
    status: "PUBLISHED",
    priceMinor: 6900,
    currency: "CNY",
    coverEmoji: "🎓",
    highlights: [
      "First-year timeline with every deadline",
      "Residence permit and health check walkthrough",
      "Campus intranet and course selection explained",
    ],
    sortOrder: 20,
  },
  {
    slug: "academic-writing-guide",
    title: "Academic Writing Guide",
    shortDescription:
      "Structure, citation and academic register for essays and dissertations written in a second language.",
    description:
      "A practical writing guide for students producing academic work in English or Chinese as a second language. Covers essay and dissertation structure, building an argument, citation styles used by Chinese universities, hedging and academic register, and a self-editing checklist. Includes annotated student examples showing a first draft beside its revised version.",
    category: "Academic skills",
    format: "DIGITAL",
    source: "KONDO",
    status: "PUBLISHED",
    priceMinor: 5900,
    currency: "CNY",
    coverEmoji: "✍️",
    highlights: [
      "Essay and dissertation structures",
      "Citation styles used in Chinese universities",
      "Annotated before-and-after student drafts",
    ],
    sortOrder: 30,
  },
  {
    slug: "ai-engineering-starter-pack",
    title: "AI Engineering Starter Pack",
    shortDescription:
      "A guided path from Python fundamentals to a deployed machine-learning project you can show.",
    description:
      "Twelve progressive modules taking you from Python fundamentals through data handling, classical machine learning and neural networks, to deploying a working project. Each module ends with an exercise and a reference solution. The final module walks through packaging your project so it can sit on a CV or a scholarship application.",
    category: "Technology",
    format: "DIGITAL",
    source: "KONDO",
    status: "PUBLISHED",
    priceMinor: 12900,
    currency: "CNY",
    coverEmoji: "🤖",
    highlights: [
      "Twelve modules with reference solutions",
      "One deployable end-of-course project",
      "Written for students without a CS background",
    ],
    sortOrder: 40,
  },
  {
    slug: "research-paper-guide",
    title: "Research Paper Guide",
    shortDescription:
      "From literature review to submission, including how to work with a Chinese supervisor.",
    description:
      "A guide to producing your first research paper: framing a question, running a literature review, choosing a method, presenting results, and preparing for submission. A dedicated chapter covers working with a supervisor in a Chinese university — expectations around meetings, drafts and authorship — which is where most international students lose time.",
    category: "Research",
    format: "DIGITAL",
    source: "KONDO",
    status: "PUBLISHED",
    priceMinor: 7900,
    currency: "CNY",
    coverEmoji: "🔬",
    highlights: [
      "Literature review to submission",
      "Working with a Chinese supervisor",
      "Templates for abstracts and method sections",
    ],
    sortOrder: 50,
  },

  // --- Kondo physical ------------------------------------------------------
  {
    slug: "kondo-student-planner",
    title: "Kondo Student Planner",
    shortDescription:
      "An academic-year planner built around the Chinese university calendar and its teaching periods.",
    description:
      "A hardcover planner laid out for the Chinese academic year, with weekly spreads matching the period-based timetable used by most universities, semester overviews, deadline trackers and a section for residence permit and visa dates. Lay-flat binding, 120gsm paper, bilingual month headers.",
    category: "Organization",
    format: "PHYSICAL",
    source: "KONDO",
    status: "PUBLISHED",
    priceMinor: 13900,
    currency: "CNY",
    coverEmoji: "📔",
    highlights: [
      "Laid out for period-based timetables",
      "Visa and residence permit tracker",
      "Lay-flat binding, 120gsm paper",
    ],
    sortOrder: 60,
  },
  {
    slug: "chinese-vocabulary-notebook",
    title: "Chinese Vocabulary Notebook",
    shortDescription:
      "Grid-ruled character practice with spaced-repetition pages for the vocabulary you actually meet.",
    description:
      "A vocabulary notebook combining tian zi ge character practice grids with spaced-repetition review pages. Each spread pairs new characters with a review column dated for one day, one week and one month later, so revision happens without a separate app. 160 pages, sewn binding, sits flat on a desk.",
    category: "Language",
    format: "PHYSICAL",
    source: "KONDO",
    status: "PUBLISHED",
    priceMinor: 4900,
    currency: "CNY",
    coverEmoji: "📝",
    highlights: [
      "Tian zi ge character grids",
      "Built-in spaced-repetition columns",
      "160 sewn pages that lie flat",
    ],
    sortOrder: 70,
  },
  {
    slug: "campus-organization-kit",
    title: "Campus Organization Kit",
    shortDescription:
      "Document folder, card holder and labelled wallets for the paperwork your university will ask for.",
    description:
      "Everything for the documents a Chinese university and the exit-entry bureau will ask for repeatedly: an A4 accordion folder with pre-labelled sections for admission, passport copies, health check and residence permit, a transparent card holder for your campus and bank cards, and three sealable wallets for photographs and receipts.",
    category: "Organization",
    format: "PHYSICAL",
    source: "KONDO",
    status: "PUBLISHED",
    priceMinor: 9900,
    currency: "CNY",
    coverEmoji: "🗂️",
    highlights: [
      "Pre-labelled for Chinese university paperwork",
      "Card holder for campus and bank cards",
      "Sealable wallets for photos and receipts",
    ],
    sortOrder: 80,
  },
  {
    slug: "engineering-student-notebook",
    title: "Engineering Student Notebook",
    shortDescription:
      "Squared and isometric paper with formula margins, for lectures that move faster than you write.",
    description:
      "A notebook for engineering and science lectures: alternating 5mm squared and isometric sections, a ruled margin for formulas and units, and a reference sheet of constants inside the cover. Perforated pages for handing in problem sets, and paper heavy enough that fineliners do not bleed through.",
    category: "Academic skills",
    format: "PHYSICAL",
    source: "KONDO",
    status: "PUBLISHED",
    priceMinor: 5900,
    currency: "CNY",
    coverEmoji: "📐",
    highlights: [
      "Squared and isometric sections",
      "Formula and unit margin",
      "Perforated pages for problem sets",
    ],
    sortOrder: 90,
  },
  {
    slug: "international-student-package",
    title: "International Student Package",
    shortDescription:
      "The planner, vocabulary notebook and organization kit together, at less than buying them separately.",
    description:
      "The three Kondo physical essentials in one package: the Student Planner, the Chinese Vocabulary Notebook and the Campus Organization Kit. Sent as a single parcel, which is what most students order in their first weeks. Includes a printed quick-start card pointing to the Kondo guides that match each item.",
    category: "Organization",
    format: "PHYSICAL",
    source: "KONDO",
    status: "PUBLISHED",
    priceMinor: 24900,
    currency: "CNY",
    coverEmoji: "🎒",
    highlights: [
      "Planner, vocabulary notebook and organization kit",
      "One parcel, one delivery",
      "Cheaper than the three items separately",
    ],
    sortOrder: 100,
  },

  // --- Partner -------------------------------------------------------------
  {
    slug: "mandarin-bridge-online-course",
    title: "Mandarin Bridge — Online Chinese Course",
    shortDescription:
      "Live small-group Chinese classes scheduled around university timetables.",
    description:
      "Live online Chinese classes in groups of no more than six, with sessions scheduled in the evenings and at weekends so they fit around university teaching. Levels run from absolute beginner to HSK 5 preparation. Enrolment, scheduling and payment are handled on the provider's own platform.",
    category: "Language",
    format: "DIGITAL",
    source: "PARTNER",
    status: "PUBLISHED",
    priceMinor: null,
    currency: "CNY",
    providerName: "Mandarin Bridge Institute",
    externalUrl: "https://example.org/mandarin-bridge",
    coverEmoji: "🗣️",
    highlights: [
      "Groups of six or fewer",
      "Evening and weekend sessions",
      "Beginner through HSK 5",
    ],
    sortOrder: 110,
  },
  {
    slug: "tsinghua-press-academic-reader",
    title: "Academic Reader for International Students",
    shortDescription:
      "A university-press reader on academic conventions in Chinese higher education.",
    description:
      "Published by a university press, this reader collects academic conventions used across Chinese higher education: citation practice, seminar participation, examination formats and the structure expected in a thesis. Sold through the publisher's own store, in print and digital editions.",
    category: "Academic skills",
    format: "PHYSICAL",
    source: "PARTNER",
    status: "PUBLISHED",
    priceMinor: null,
    currency: "CNY",
    providerName: "University Academic Press",
    externalUrl: "https://example.org/academic-reader",
    coverEmoji: "📚",
    highlights: [
      "Published by a university press",
      "Citation, seminar and thesis conventions",
      "Print and digital editions",
    ],
    sortOrder: 120,
  },
  {
    slug: "shenzhen-code-lab-bootcamp",
    title: "Code Lab — Web Development Bootcamp",
    shortDescription:
      "A part-time coding bootcamp with a student rate and a project-based final assessment.",
    description:
      "A part-time web development bootcamp running over sixteen weeks, designed to sit alongside a degree. Covers front-end fundamentals, back-end services and deployment, assessed on a project rather than an examination. A student rate is available on proof of enrolment. Applications and payment are handled by the provider.",
    category: "Technology",
    format: "DIGITAL",
    source: "PARTNER",
    status: "PUBLISHED",
    priceMinor: null,
    currency: "CNY",
    providerName: "Code Lab Shenzhen",
    externalUrl: "https://example.org/code-lab",
    coverEmoji: "💻",
    highlights: [
      "Sixteen weeks, part-time",
      "Project-based assessment",
      "Student rate on proof of enrolment",
    ],
    sortOrder: 130,
  },
  {
    slug: "career-preparation-guide-partner",
    title: "Career Preparation Guide for Graduates in China",
    shortDescription:
      "CV conventions, interview practice and work-permit basics for graduating internationally.",
    description:
      "A career guide for international students finishing a degree in China: CV and cover-letter conventions used by Chinese employers, interview formats, salary expectations by city, and an overview of the work-permit categories a graduate can apply for. Distributed by the partner on their careers platform.",
    category: "Career",
    format: "DIGITAL",
    source: "PARTNER",
    status: "PUBLISHED",
    priceMinor: null,
    currency: "CNY",
    providerName: "Bridge Careers",
    externalUrl: "https://example.org/career-preparation",
    coverEmoji: "💼",
    highlights: [
      "CV conventions for Chinese employers",
      "Salary expectations by city",
      "Work-permit categories explained",
    ],
    sortOrder: 140,
  },
  {
    slug: "scholarship-application-masterclass",
    title: "Scholarship Application Masterclass",
    shortDescription:
      "Recorded sessions on CSC and university scholarship applications, with annotated examples.",
    description:
      "Recorded masterclass sessions covering the Chinese Government Scholarship and university-level schemes: eligibility, choosing a supervisor, the study plan, reference letters and timing. Includes annotated examples of successful applications. Access is granted on the partner's platform.",
    category: "Scholarships",
    format: "DIGITAL",
    source: "PARTNER",
    status: "PUBLISHED",
    priceMinor: null,
    currency: "CNY",
    providerName: "Study Path Advisors",
    externalUrl: "https://example.org/scholarship-masterclass",
    coverEmoji: "🏅",
    highlights: [
      "CSC and university schemes",
      "Study plan and supervisor guidance",
      "Annotated successful applications",
    ],
    sortOrder: 150,
  },
];

async function main() {
  let created = 0;
  let updated = 0;
  for (const entry of CATALOGUE) {
    const existing = await prisma.studyEssential.findUnique({
      where: { slug: entry.slug },
      select: { id: true },
    });
    await prisma.studyEssential.upsert({
      where: { slug: entry.slug },
      create: { ...entry, publishedAt: new Date() },
      update: { ...entry, publishedAt: new Date() },
    });
    if (existing) updated += 1;
    else created += 1;
  }
  console.log(
    `Study Essentials catalogue ready: ${created} created, ${updated} updated, ${CATALOGUE.length} total.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
