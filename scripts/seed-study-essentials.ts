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
    slug: "artificial-intelligence-fundamentals",
    title: "Artificial Intelligence Fundamentals",
    shortDescription:
      "A first course in AI: what the field actually claims, how the main methods work, and where each one breaks.",
    description:
      "Written for students meeting artificial intelligence as a subject rather than a headline. It builds from what a learning system is, through the methods that dominate current practice, to the questions of evaluation and responsibility that decide whether a model should be used at all. Each chapter assumes only the previous ones and closes on the limits of what it just taught. Used as the worked example throughout the Kondo reader.",
    category: "Technology",
    format: "DIGITAL",
    source: "KONDO",
    status: "PUBLISHED",
    priceMinor: 9900,
    currency: "CNY",
    coverEmoji: "🧠",
    highlights: [
      "Six chapters, each ending on its own limits",
      "No prior machine-learning background assumed",
      "The worked example for highlights, notes and tasks",
    ],
    sortOrder: 5,
  },
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

/**
 * Readable content for the Kondo digital titles, so My Library has something
 * to open rather than an empty shell. Chapters are replaced wholesale on each
 * run, which is safe because notes reference a chapter with ON DELETE SET NULL
 * and keep their own highlight text.
 */
const CHAPTERS: Record<string, { title: string; body: string }[]> = {
  "artificial-intelligence-fundamentals": [
    {
      title: "What artificial intelligence actually means",
      body: "The phrase covers two quite different claims. The weak claim is that a machine can perform a task that, done by a person, would be said to require intelligence. The strong claim is that the machine understands what it is doing. Almost everything built today rests on the weak claim, and confusing the two is the most common error in public discussion of the field.\n\nA useful working definition: an artificial intelligence system takes in data about the world, produces an output intended to be useful, and improves that output as it receives more data. Note what this definition does not require — consciousness, understanding, or any resemblance to how a brain works.\n\nThe field divides roughly into symbolic approaches, which encode knowledge as explicit rules, and statistical approaches, which infer patterns from examples. The last two decades belong overwhelmingly to the statistical side, but the symbolic tradition solved problems that statistical methods still handle poorly, and the boundary is less settled than current practice suggests.",
    },
    {
      title: "Learning from data",
      body: "Machine learning allows systems to improve their predictions from data rather than from explicit instructions. The mechanism is simple to state: define a measure of how wrong the system currently is, then adjust its parameters to reduce that measure.\n\nThree settings recur. In supervised learning, each example arrives with the correct answer attached, and the system learns to reproduce it. In unsupervised learning, no answers are given, and the system finds structure — clusters, directions of variation — on its own. In reinforcement learning, the system acts, receives a reward, and learns which actions lead to reward over time.\n\nThe hard part is rarely the algorithm. It is deciding what the correct answer even is, and obtaining enough examples of it. A dataset is an argument about what matters, made in advance and usually left unexamined.",
    },
    {
      title: "Neural networks",
      body: "A neural network is a stack of simple functions, each taking the previous layer's output and passing on its own. Every connection has a weight, and learning means adjusting those weights so the final output is closer to what was wanted.\n\nThe idea is old. What changed was scale: enough data to fit millions of parameters, enough computation to fit them in reasonable time, and a training procedure — backpropagation with gradient descent — that remains stable at that size.\n\nDepth matters because each layer can build on the representation the previous one produced. Early layers in a vision network detect edges; later layers combine edges into shapes, and shapes into objects. Nobody specifies this hierarchy; it emerges from training. That is the source of both the method's power and its opacity — the network's internal representation is not something anyone designed, and it is often not something anyone can read.",
    },
    {
      title: "Evaluation, and how it goes wrong",
      body: "A model that performs well on the data it was trained on has demonstrated nothing. The only meaningful test is performance on data it has never seen, which is why any honest evaluation holds out a portion of the data from the start.\n\nOverfitting is the failure mode: the model memorises the training examples, including their noise, and fails on anything new. It is detected by the gap between training performance and held-out performance, and reduced by more data, a simpler model, or explicit constraints during training.\n\nAccuracy alone is a poor measure. A test for a condition affecting one person in a thousand can be 99.9% accurate while never detecting a single case. Which metric to report is a decision about what kind of error is acceptable — and that is a question about the world the model is used in, not about the model.",
    },
    {
      title: "Where these systems fail",
      body: "A model learns the distribution it was trained on. Presented with data drawn from a different distribution, it does not fail loudly; it produces a confident answer that happens to be wrong. This is the central practical risk in deployment.\n\nBias in a model is usually bias in its data, faithfully reproduced. A hiring model trained on past decisions learns those decisions, including the ones nobody would defend. Removing the sensitive attribute does not remove the bias, because other attributes stand in for it.\n\nThe third failure is one of framing: a system optimises the objective it was given, not the goal that objective was meant to represent. When the two diverge — and at scale they usually do — the system pursues the measure and abandons the intent.",
    },
    {
      title: "Using these systems responsibly",
      body: "Whether a model should be deployed is not a technical question, and it is not answered by the model's accuracy. It depends on what happens when the model is wrong, who bears that cost, and whether they had any say in the matter.\n\nThree questions are worth asking of any deployed system. What decision does it actually influence? Who can contest its output, and how? What would have to be true for it to be withdrawn? A system with no answer to the third question is not being evaluated at all.\n\nThe field's current capabilities are real and its trajectory is steep. Neither fact settles the question of where these systems belong — and that question is one every student entering the field will be asked to answer, in practice, long before it is settled in theory.",
    },
  ],
  "hsk-complete-preparation-guide": [
    {
      title: "Before you start: choosing your level",
      body: "Most students pick an HSK level from the number of characters they recognise, which is the wrong measure. The examination tests recognition under time pressure, listening at natural speed, and — from HSK 4 — the ability to produce written sentences.\n\nStart with the diagnostic at the end of this chapter. Take it without a dictionary and without pausing the audio. Score yourself honestly. If you are between two levels, prepare for the lower one and sit the higher paper: the confidence you gain from a comfortable pass is worth more than a marginal one.",
    },
    {
      title: "Vocabulary that actually appears",
      body: "The official word lists are long, and not every word carries the same weight. Roughly a fifth of the vocabulary accounts for most of what appears in reading passages, because examiners build passages around everyday situations: renting, travelling, studying, seeing a doctor.\n\nLearn words in the situations they belong to rather than alphabetically. A word met inside a sentence about registering at a university is remembered; the same word met in a column of two hundred is not.",
    },
    {
      title: "Listening at natural speed",
      body: "Listening is the section international students lose most marks on, and the reason is rarely vocabulary. It is that the audio does not pause where a learner expects a pause.\n\nTrain with material played once, at full speed, with no transcript on the first pass. Write down only what you caught. Then replay with the transcript and mark the gap between what was said and what you heard. That gap, not the word list, is your syllabus.",
    },
    {
      title: "The written paper",
      body: "From HSK 4 the paper asks you to produce language, not only recognise it. Marks come from sentences that are complete and correct, not from sentences that are ambitious.\n\nBuild a small set of reliable structures you can write without hesitation, and use them. A paper made of correct simple sentences scores better than one made of half-finished complex ones.",
    },
    {
      title: "The last two weeks",
      body: "Stop learning new vocabulary two weeks before the examination. The words will not settle in time and the effort is better spent elsewhere.\n\nUse the remaining time on full mock papers, taken at the hour of your real examination, in one sitting, with no interruptions. You are training stamina and timing now, not knowledge.",
    },
  ],
  "chinese-university-survival-handbook": [
    {
      title: "The first week",
      body: "Campus registration, the residence permit and the health check all have their own queues and their own deadlines, and they do not wait for each other. The residence permit is the one with legal consequences: you have thirty days from entry.\n\nGo to the international student office on your first working day, even if you have nothing to hand in. Ask for the list of deadlines that apply to your programme and write them down. Nobody will chase you.",
    },
    {
      title: "Residence permit and the health check",
      body: "The health check must be done at a designated public facility; a report from a private clinic is usually refused. Bring your passport, admission letter and passport photographs, and go early — the examination is done fasting.\n\nThe residence permit application follows the health check. Budget two visits to the exit-entry bureau, and do not book travel until the permit is in your passport.",
    },
    {
      title: "Course selection and the campus intranet",
      body: "Course selection usually happens on an internal system that opens for a short window and is not translated. Ask a second-year student from your programme to sit with you the first time; this saves more trouble than any guide.\n\nScreenshot your selected courses once the window closes. Systems change and screenshots settle disputes.",
    },
    {
      title: "Money, phones and daily life",
      body: "A Chinese bank account and a phone number registered in your name unlock nearly everything else — payments, deliveries, campus services. Open the account before you need it, not when you do.\n\nKeep a small amount of cash for the first days. Not everything works before your account is active.",
    },
  ],
  "academic-writing-guide": [
    {
      title: "What an academic argument is",
      body: "An academic argument is a claim you defend with evidence, in an order a reader can follow. It is not a summary of what has been read, and it is not an opinion.\n\nMost weak drafts fail at the claim: they describe a topic instead of asserting something about it. Before writing, put your claim in one sentence. If you cannot, the reading is not finished.",
    },
    {
      title: "Structure that carries the reader",
      body: "A paragraph does one job. It opens by saying what it will establish, establishes it, and closes by connecting to the next.\n\nWhen a paragraph does two jobs, split it. When it does none, cut it. This single habit improves more drafts than any advice about vocabulary.",
    },
    {
      title: "Citation without anxiety",
      body: "Cite when the idea is not yours, when the wording is not yours, and when a reader might want to check. Chinese universities vary in the style they require, so ask your department rather than guessing.\n\nKeep a reference as soon as you read the source. Reconstructing citations at the end is where most accidental plagiarism happens.",
    },
    {
      title: "Editing your own work",
      body: "Edit in passes, each with one purpose: argument, then structure, then sentences, then references. Trying to fix everything at once fixes nothing well.\n\nRead the draft aloud for the sentence pass. A sentence you cannot say comfortably is one your reader will stumble over.",
    },
  ],
  "ai-engineering-starter-pack": [
    {
      title: "Python you actually need",
      body: "You do not need all of Python to start. You need lists, dictionaries, functions, and enough understanding of imports to read someone else's code.\n\nWrite small programs that do something real from the first week: read a file, count something, print a summary. Reading tutorials without writing code produces the feeling of progress without the fact of it.",
    },
    {
      title: "Working with data",
      body: "Most of the work in a machine-learning project is preparing data, and most beginners underestimate this by an order of magnitude.\n\nLearn to load a dataset, inspect it, find the missing values and decide what to do about them. A model trained on data you have not looked at will teach you nothing about the problem.",
    },
    {
      title: "Your first model",
      body: "Start with a model simple enough to explain to a classmate. Linear and tree-based models are not toys — they are strong baselines that a neural network often fails to beat.\n\nAlways compare against the simplest reasonable answer. A model that cannot beat 'predict the average' is not a model.",
    },
    {
      title: "Neural networks, briefly",
      body: "A neural network is a stack of simple functions whose parameters are adjusted to reduce an error. The ideas that matter early are the loss, the optimiser and overfitting.\n\nTrain on a small dataset first so a full run takes seconds. Fast feedback is worth more than a large experiment you run once.",
    },
    {
      title: "Deploying something you can show",
      body: "A project nobody can run is hard to put on an application. Package your model behind a small interface, write a short README, and make sure a stranger can start it.\n\nThe goal of this chapter is not scale. It is that a supervisor or an employer can open a link and see your work.",
    },
  ],
  "research-paper-guide": [
    {
      title: "Framing a question",
      body: "A research question is narrow enough to answer and open enough to be worth asking. 'What is machine learning' is neither.\n\nWrite your question, then write what an answer would look like. If you cannot describe the answer's shape, narrow the question.",
    },
    {
      title: "The literature review",
      body: "A literature review is an argument about a field, not a list of papers. It says: here is what is known, here is what is disputed, here is the gap this work addresses.\n\nRead the most-cited paper first and follow its references backwards. This finds the conversation faster than a keyword search.",
    },
    {
      title: "Working with your supervisor",
      body: "Expectations differ. In many Chinese departments a supervisor expects to be shown work regularly and briefly, rather than a finished draft at the end.\n\nAgree at the first meeting how often you will meet, what you will bring, and how authorship will be handled. Writing this down prevents most of the problems international students report.",
    },
    {
      title: "Preparing to submit",
      body: "Match the target venue's format before the final read, not after: reformatting late introduces errors in exactly the places nobody re-checks.\n\nGive yourself one full day between finishing and submitting. Everything you find on that day, you would otherwise have found after submission.",
    },
  ],
};

async function main() {
  let created = 0;
  let updated = 0;
  for (const entry of CATALOGUE) {
    const existing = await prisma.studyEssential.findUnique({
      where: { slug: entry.slug },
      select: { id: true },
    });
    const essential = await prisma.studyEssential.upsert({
      where: { slug: entry.slug },
      create: { ...entry, publishedAt: new Date() },
      update: { ...entry, publishedAt: new Date() },
      select: { id: true },
    });
    if (existing) updated += 1;
    else created += 1;

    const chapters = CHAPTERS[entry.slug];
    if (chapters) {
      await prisma.studyEssentialChapter.deleteMany({
        where: { essentialId: essential.id },
      });
      await prisma.studyEssentialChapter.createMany({
        data: chapters.map((chapter, index) => ({
          essentialId: essential.id,
          position: index + 1,
          title: chapter.title,
          body: chapter.body,
        })),
      });
    }
  }
  const chapterCount = await prisma.studyEssentialChapter.count();
  console.log(
    `Study Essentials catalogue ready: ${created} created, ${updated} updated, ${CATALOGUE.length} total, ${chapterCount} chapters.`,
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
