-- Study Essentials catalogue, curated by Kondo.
--
-- Shipped as a migration for the same reason as the country and university
-- directories: it is reference data the product needs in every environment,
-- not demo data. Rows are matched on their stable slug and updated in place,
-- so orders, notes and reading progress that reference them are preserved.
--
-- Chapters resolve their parent through the slug rather than a hardcoded id:
-- an environment where the catalogue was provisioned by the seed script holds
-- the same slugs under different ids, and a literal id would fail its foreign
-- key there.

INSERT INTO "StudyEssential" ("id", "slug", "title", "shortDescription", "description", "category", "format", "source", "status", "priceMinor", "currency", "providerName", "externalUrl", "imageUrl", "coverEmoji", "highlights", "sortOrder", "publishedAt", "createdAt", "updatedAt")
VALUES ('cmsdmfno50000829p3o6gjni7', 'hsk-complete-preparation-guide', 'HSK Complete Preparation Guide', 'Every HSK level in one plan, with vocabulary drills, mock papers and a week-by-week revision schedule.', 'A complete preparation path from HSK 1 to HSK 6, written with students who arrived in China without prior Chinese. Each level opens with a diagnostic, then a six-week plan covering vocabulary, grammar patterns, listening and the written paper. Includes four full mock examinations per level with worked answers, and a printable revision tracker you can keep beside your timetable.', 'Language', 'DIGITAL'::"StudyEssentialFormat", 'KONDO'::"StudyEssentialSource", 'PUBLISHED'::"StudyEssentialStatus", 8900, 'CNY', NULL, NULL, NULL, '🀄', ARRAY['HSK 1 to 6 in one guide', '24 mock papers with worked answers', 'Printable six-week revision tracker']::text[], 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "shortDescription" = EXCLUDED."shortDescription",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "format" = EXCLUDED."format",
  "source" = EXCLUDED."source",
  "status" = EXCLUDED."status",
  "priceMinor" = EXCLUDED."priceMinor",
  "currency" = EXCLUDED."currency",
  "providerName" = EXCLUDED."providerName",
  "externalUrl" = EXCLUDED."externalUrl",
  "coverEmoji" = EXCLUDED."coverEmoji",
  "highlights" = EXCLUDED."highlights",
  "sortOrder" = EXCLUDED."sortOrder",
  "publishedAt" = COALESCE("StudyEssential"."publishedAt", EXCLUDED."publishedAt"),
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssential" ("id", "slug", "title", "shortDescription", "description", "category", "format", "source", "status", "priceMinor", "currency", "providerName", "externalUrl", "imageUrl", "coverEmoji", "highlights", "sortOrder", "publishedAt", "createdAt", "updatedAt")
VALUES ('cmsdmfnoa0001829p04cbo2h9', 'chinese-university-survival-handbook', 'Chinese University Survival Handbook', 'Registration, residence permits, campus systems and the paperwork nobody explains before you land.', 'The handbook covers your first year end to end: campus registration, the residence permit window, opening a bank account, the health check, using the campus intranet, and how course selection actually works. Written from the experience of international students across Beijing, Shanghai, Hangzhou and Jiaxing, with the deadlines that catch people out marked clearly.', 'Student life', 'DIGITAL'::"StudyEssentialFormat", 'KONDO'::"StudyEssentialSource", 'PUBLISHED'::"StudyEssentialStatus", 6900, 'CNY', NULL, NULL, NULL, '🎓', ARRAY['First-year timeline with every deadline', 'Residence permit and health check walkthrough', 'Campus intranet and course selection explained']::text[], 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "shortDescription" = EXCLUDED."shortDescription",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "format" = EXCLUDED."format",
  "source" = EXCLUDED."source",
  "status" = EXCLUDED."status",
  "priceMinor" = EXCLUDED."priceMinor",
  "currency" = EXCLUDED."currency",
  "providerName" = EXCLUDED."providerName",
  "externalUrl" = EXCLUDED."externalUrl",
  "coverEmoji" = EXCLUDED."coverEmoji",
  "highlights" = EXCLUDED."highlights",
  "sortOrder" = EXCLUDED."sortOrder",
  "publishedAt" = COALESCE("StudyEssential"."publishedAt", EXCLUDED."publishedAt"),
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssential" ("id", "slug", "title", "shortDescription", "description", "category", "format", "source", "status", "priceMinor", "currency", "providerName", "externalUrl", "imageUrl", "coverEmoji", "highlights", "sortOrder", "publishedAt", "createdAt", "updatedAt")
VALUES ('cmsdmfnoc0002829puvl9mf2l', 'academic-writing-guide', 'Academic Writing Guide', 'Structure, citation and academic register for essays and dissertations written in a second language.', 'A practical writing guide for students producing academic work in English or Chinese as a second language. Covers essay and dissertation structure, building an argument, citation styles used by Chinese universities, hedging and academic register, and a self-editing checklist. Includes annotated student examples showing a first draft beside its revised version.', 'Academic skills', 'DIGITAL'::"StudyEssentialFormat", 'KONDO'::"StudyEssentialSource", 'PUBLISHED'::"StudyEssentialStatus", 5900, 'CNY', NULL, NULL, NULL, '✍️', ARRAY['Essay and dissertation structures', 'Citation styles used in Chinese universities', 'Annotated before-and-after student drafts']::text[], 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "shortDescription" = EXCLUDED."shortDescription",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "format" = EXCLUDED."format",
  "source" = EXCLUDED."source",
  "status" = EXCLUDED."status",
  "priceMinor" = EXCLUDED."priceMinor",
  "currency" = EXCLUDED."currency",
  "providerName" = EXCLUDED."providerName",
  "externalUrl" = EXCLUDED."externalUrl",
  "coverEmoji" = EXCLUDED."coverEmoji",
  "highlights" = EXCLUDED."highlights",
  "sortOrder" = EXCLUDED."sortOrder",
  "publishedAt" = COALESCE("StudyEssential"."publishedAt", EXCLUDED."publishedAt"),
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssential" ("id", "slug", "title", "shortDescription", "description", "category", "format", "source", "status", "priceMinor", "currency", "providerName", "externalUrl", "imageUrl", "coverEmoji", "highlights", "sortOrder", "publishedAt", "createdAt", "updatedAt")
VALUES ('cmsdmfnoe0003829p7e9at2g5', 'ai-engineering-starter-pack', 'AI Engineering Starter Pack', 'A guided path from Python fundamentals to a deployed machine-learning project you can show.', 'Twelve progressive modules taking you from Python fundamentals through data handling, classical machine learning and neural networks, to deploying a working project. Each module ends with an exercise and a reference solution. The final module walks through packaging your project so it can sit on a CV or a scholarship application.', 'Technology', 'DIGITAL'::"StudyEssentialFormat", 'KONDO'::"StudyEssentialSource", 'PUBLISHED'::"StudyEssentialStatus", 12900, 'CNY', NULL, NULL, NULL, '🤖', ARRAY['Twelve modules with reference solutions', 'One deployable end-of-course project', 'Written for students without a CS background']::text[], 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "shortDescription" = EXCLUDED."shortDescription",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "format" = EXCLUDED."format",
  "source" = EXCLUDED."source",
  "status" = EXCLUDED."status",
  "priceMinor" = EXCLUDED."priceMinor",
  "currency" = EXCLUDED."currency",
  "providerName" = EXCLUDED."providerName",
  "externalUrl" = EXCLUDED."externalUrl",
  "coverEmoji" = EXCLUDED."coverEmoji",
  "highlights" = EXCLUDED."highlights",
  "sortOrder" = EXCLUDED."sortOrder",
  "publishedAt" = COALESCE("StudyEssential"."publishedAt", EXCLUDED."publishedAt"),
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssential" ("id", "slug", "title", "shortDescription", "description", "category", "format", "source", "status", "priceMinor", "currency", "providerName", "externalUrl", "imageUrl", "coverEmoji", "highlights", "sortOrder", "publishedAt", "createdAt", "updatedAt")
VALUES ('cmsdmfnof0004829pljqd2thm', 'research-paper-guide', 'Research Paper Guide', 'From literature review to submission, including how to work with a Chinese supervisor.', 'A guide to producing your first research paper: framing a question, running a literature review, choosing a method, presenting results, and preparing for submission. A dedicated chapter covers working with a supervisor in a Chinese university — expectations around meetings, drafts and authorship — which is where most international students lose time.', 'Research', 'DIGITAL'::"StudyEssentialFormat", 'KONDO'::"StudyEssentialSource", 'PUBLISHED'::"StudyEssentialStatus", 7900, 'CNY', NULL, NULL, NULL, '🔬', ARRAY['Literature review to submission', 'Working with a Chinese supervisor', 'Templates for abstracts and method sections']::text[], 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "shortDescription" = EXCLUDED."shortDescription",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "format" = EXCLUDED."format",
  "source" = EXCLUDED."source",
  "status" = EXCLUDED."status",
  "priceMinor" = EXCLUDED."priceMinor",
  "currency" = EXCLUDED."currency",
  "providerName" = EXCLUDED."providerName",
  "externalUrl" = EXCLUDED."externalUrl",
  "coverEmoji" = EXCLUDED."coverEmoji",
  "highlights" = EXCLUDED."highlights",
  "sortOrder" = EXCLUDED."sortOrder",
  "publishedAt" = COALESCE("StudyEssential"."publishedAt", EXCLUDED."publishedAt"),
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssential" ("id", "slug", "title", "shortDescription", "description", "category", "format", "source", "status", "priceMinor", "currency", "providerName", "externalUrl", "imageUrl", "coverEmoji", "highlights", "sortOrder", "publishedAt", "createdAt", "updatedAt")
VALUES ('cmsdmfnoh0005829pmk1odow9', 'kondo-student-planner', 'Kondo Student Planner', 'An academic-year planner built around the Chinese university calendar and its teaching periods.', 'A hardcover planner laid out for the Chinese academic year, with weekly spreads matching the period-based timetable used by most universities, semester overviews, deadline trackers and a section for residence permit and visa dates. Lay-flat binding, 120gsm paper, bilingual month headers.', 'Organization', 'PHYSICAL'::"StudyEssentialFormat", 'KONDO'::"StudyEssentialSource", 'PUBLISHED'::"StudyEssentialStatus", 13900, 'CNY', NULL, NULL, NULL, '📔', ARRAY['Laid out for period-based timetables', 'Visa and residence permit tracker', 'Lay-flat binding, 120gsm paper']::text[], 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "shortDescription" = EXCLUDED."shortDescription",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "format" = EXCLUDED."format",
  "source" = EXCLUDED."source",
  "status" = EXCLUDED."status",
  "priceMinor" = EXCLUDED."priceMinor",
  "currency" = EXCLUDED."currency",
  "providerName" = EXCLUDED."providerName",
  "externalUrl" = EXCLUDED."externalUrl",
  "coverEmoji" = EXCLUDED."coverEmoji",
  "highlights" = EXCLUDED."highlights",
  "sortOrder" = EXCLUDED."sortOrder",
  "publishedAt" = COALESCE("StudyEssential"."publishedAt", EXCLUDED."publishedAt"),
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssential" ("id", "slug", "title", "shortDescription", "description", "category", "format", "source", "status", "priceMinor", "currency", "providerName", "externalUrl", "imageUrl", "coverEmoji", "highlights", "sortOrder", "publishedAt", "createdAt", "updatedAt")
VALUES ('cmsdmfnoi0006829pcdkt7b29', 'chinese-vocabulary-notebook', 'Chinese Vocabulary Notebook', 'Grid-ruled character practice with spaced-repetition pages for the vocabulary you actually meet.', 'A vocabulary notebook combining tian zi ge character practice grids with spaced-repetition review pages. Each spread pairs new characters with a review column dated for one day, one week and one month later, so revision happens without a separate app. 160 pages, sewn binding, sits flat on a desk.', 'Language', 'PHYSICAL'::"StudyEssentialFormat", 'KONDO'::"StudyEssentialSource", 'PUBLISHED'::"StudyEssentialStatus", 4900, 'CNY', NULL, NULL, NULL, '📝', ARRAY['Tian zi ge character grids', 'Built-in spaced-repetition columns', '160 sewn pages that lie flat']::text[], 70, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "shortDescription" = EXCLUDED."shortDescription",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "format" = EXCLUDED."format",
  "source" = EXCLUDED."source",
  "status" = EXCLUDED."status",
  "priceMinor" = EXCLUDED."priceMinor",
  "currency" = EXCLUDED."currency",
  "providerName" = EXCLUDED."providerName",
  "externalUrl" = EXCLUDED."externalUrl",
  "coverEmoji" = EXCLUDED."coverEmoji",
  "highlights" = EXCLUDED."highlights",
  "sortOrder" = EXCLUDED."sortOrder",
  "publishedAt" = COALESCE("StudyEssential"."publishedAt", EXCLUDED."publishedAt"),
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssential" ("id", "slug", "title", "shortDescription", "description", "category", "format", "source", "status", "priceMinor", "currency", "providerName", "externalUrl", "imageUrl", "coverEmoji", "highlights", "sortOrder", "publishedAt", "createdAt", "updatedAt")
VALUES ('cmsdmfnoj0007829pu2xjtth8', 'campus-organization-kit', 'Campus Organization Kit', 'Document folder, card holder and labelled wallets for the paperwork your university will ask for.', 'Everything for the documents a Chinese university and the exit-entry bureau will ask for repeatedly: an A4 accordion folder with pre-labelled sections for admission, passport copies, health check and residence permit, a transparent card holder for your campus and bank cards, and three sealable wallets for photographs and receipts.', 'Organization', 'PHYSICAL'::"StudyEssentialFormat", 'KONDO'::"StudyEssentialSource", 'PUBLISHED'::"StudyEssentialStatus", 9900, 'CNY', NULL, NULL, NULL, '🗂️', ARRAY['Pre-labelled for Chinese university paperwork', 'Card holder for campus and bank cards', 'Sealable wallets for photos and receipts']::text[], 80, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "shortDescription" = EXCLUDED."shortDescription",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "format" = EXCLUDED."format",
  "source" = EXCLUDED."source",
  "status" = EXCLUDED."status",
  "priceMinor" = EXCLUDED."priceMinor",
  "currency" = EXCLUDED."currency",
  "providerName" = EXCLUDED."providerName",
  "externalUrl" = EXCLUDED."externalUrl",
  "coverEmoji" = EXCLUDED."coverEmoji",
  "highlights" = EXCLUDED."highlights",
  "sortOrder" = EXCLUDED."sortOrder",
  "publishedAt" = COALESCE("StudyEssential"."publishedAt", EXCLUDED."publishedAt"),
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssential" ("id", "slug", "title", "shortDescription", "description", "category", "format", "source", "status", "priceMinor", "currency", "providerName", "externalUrl", "imageUrl", "coverEmoji", "highlights", "sortOrder", "publishedAt", "createdAt", "updatedAt")
VALUES ('cmsdmfnok0008829pchphzwcv', 'engineering-student-notebook', 'Engineering Student Notebook', 'Squared and isometric paper with formula margins, for lectures that move faster than you write.', 'A notebook for engineering and science lectures: alternating 5mm squared and isometric sections, a ruled margin for formulas and units, and a reference sheet of constants inside the cover. Perforated pages for handing in problem sets, and paper heavy enough that fineliners do not bleed through.', 'Academic skills', 'PHYSICAL'::"StudyEssentialFormat", 'KONDO'::"StudyEssentialSource", 'PUBLISHED'::"StudyEssentialStatus", 5900, 'CNY', NULL, NULL, NULL, '📐', ARRAY['Squared and isometric sections', 'Formula and unit margin', 'Perforated pages for problem sets']::text[], 90, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "shortDescription" = EXCLUDED."shortDescription",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "format" = EXCLUDED."format",
  "source" = EXCLUDED."source",
  "status" = EXCLUDED."status",
  "priceMinor" = EXCLUDED."priceMinor",
  "currency" = EXCLUDED."currency",
  "providerName" = EXCLUDED."providerName",
  "externalUrl" = EXCLUDED."externalUrl",
  "coverEmoji" = EXCLUDED."coverEmoji",
  "highlights" = EXCLUDED."highlights",
  "sortOrder" = EXCLUDED."sortOrder",
  "publishedAt" = COALESCE("StudyEssential"."publishedAt", EXCLUDED."publishedAt"),
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssential" ("id", "slug", "title", "shortDescription", "description", "category", "format", "source", "status", "priceMinor", "currency", "providerName", "externalUrl", "imageUrl", "coverEmoji", "highlights", "sortOrder", "publishedAt", "createdAt", "updatedAt")
VALUES ('cmsdmfnol0009829popf0a9ao', 'international-student-package', 'International Student Package', 'The planner, vocabulary notebook and organization kit together, at less than buying them separately.', 'The three Kondo physical essentials in one package: the Student Planner, the Chinese Vocabulary Notebook and the Campus Organization Kit. Sent as a single parcel, which is what most students order in their first weeks. Includes a printed quick-start card pointing to the Kondo guides that match each item.', 'Organization', 'PHYSICAL'::"StudyEssentialFormat", 'KONDO'::"StudyEssentialSource", 'PUBLISHED'::"StudyEssentialStatus", 24900, 'CNY', NULL, NULL, NULL, '🎒', ARRAY['Planner, vocabulary notebook and organization kit', 'One parcel, one delivery', 'Cheaper than the three items separately']::text[], 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "shortDescription" = EXCLUDED."shortDescription",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "format" = EXCLUDED."format",
  "source" = EXCLUDED."source",
  "status" = EXCLUDED."status",
  "priceMinor" = EXCLUDED."priceMinor",
  "currency" = EXCLUDED."currency",
  "providerName" = EXCLUDED."providerName",
  "externalUrl" = EXCLUDED."externalUrl",
  "coverEmoji" = EXCLUDED."coverEmoji",
  "highlights" = EXCLUDED."highlights",
  "sortOrder" = EXCLUDED."sortOrder",
  "publishedAt" = COALESCE("StudyEssential"."publishedAt", EXCLUDED."publishedAt"),
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssential" ("id", "slug", "title", "shortDescription", "description", "category", "format", "source", "status", "priceMinor", "currency", "providerName", "externalUrl", "imageUrl", "coverEmoji", "highlights", "sortOrder", "publishedAt", "createdAt", "updatedAt")
VALUES ('cmsdmfnom000a829pwhmavp58', 'mandarin-bridge-online-course', 'Mandarin Bridge — Online Chinese Course', 'Live small-group Chinese classes scheduled around university timetables.', 'Live online Chinese classes in groups of no more than six, with sessions scheduled in the evenings and at weekends so they fit around university teaching. Levels run from absolute beginner to HSK 5 preparation. Enrolment, scheduling and payment are handled on the provider''s own platform.', 'Language', 'DIGITAL'::"StudyEssentialFormat", 'PARTNER'::"StudyEssentialSource", 'PUBLISHED'::"StudyEssentialStatus", NULL, 'CNY', 'Mandarin Bridge Institute', 'https://example.org/mandarin-bridge', NULL, '🗣️', ARRAY['Groups of six or fewer', 'Evening and weekend sessions', 'Beginner through HSK 5']::text[], 110, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "shortDescription" = EXCLUDED."shortDescription",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "format" = EXCLUDED."format",
  "source" = EXCLUDED."source",
  "status" = EXCLUDED."status",
  "priceMinor" = EXCLUDED."priceMinor",
  "currency" = EXCLUDED."currency",
  "providerName" = EXCLUDED."providerName",
  "externalUrl" = EXCLUDED."externalUrl",
  "coverEmoji" = EXCLUDED."coverEmoji",
  "highlights" = EXCLUDED."highlights",
  "sortOrder" = EXCLUDED."sortOrder",
  "publishedAt" = COALESCE("StudyEssential"."publishedAt", EXCLUDED."publishedAt"),
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssential" ("id", "slug", "title", "shortDescription", "description", "category", "format", "source", "status", "priceMinor", "currency", "providerName", "externalUrl", "imageUrl", "coverEmoji", "highlights", "sortOrder", "publishedAt", "createdAt", "updatedAt")
VALUES ('cmsdmfnop000b829p7h63izh0', 'tsinghua-press-academic-reader', 'Academic Reader for International Students', 'A university-press reader on academic conventions in Chinese higher education.', 'Published by a university press, this reader collects academic conventions used across Chinese higher education: citation practice, seminar participation, examination formats and the structure expected in a thesis. Sold through the publisher''s own store, in print and digital editions.', 'Academic skills', 'PHYSICAL'::"StudyEssentialFormat", 'PARTNER'::"StudyEssentialSource", 'PUBLISHED'::"StudyEssentialStatus", NULL, 'CNY', 'University Academic Press', 'https://example.org/academic-reader', NULL, '📚', ARRAY['Published by a university press', 'Citation, seminar and thesis conventions', 'Print and digital editions']::text[], 120, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "shortDescription" = EXCLUDED."shortDescription",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "format" = EXCLUDED."format",
  "source" = EXCLUDED."source",
  "status" = EXCLUDED."status",
  "priceMinor" = EXCLUDED."priceMinor",
  "currency" = EXCLUDED."currency",
  "providerName" = EXCLUDED."providerName",
  "externalUrl" = EXCLUDED."externalUrl",
  "coverEmoji" = EXCLUDED."coverEmoji",
  "highlights" = EXCLUDED."highlights",
  "sortOrder" = EXCLUDED."sortOrder",
  "publishedAt" = COALESCE("StudyEssential"."publishedAt", EXCLUDED."publishedAt"),
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssential" ("id", "slug", "title", "shortDescription", "description", "category", "format", "source", "status", "priceMinor", "currency", "providerName", "externalUrl", "imageUrl", "coverEmoji", "highlights", "sortOrder", "publishedAt", "createdAt", "updatedAt")
VALUES ('cmsdmfnor000c829pvi5jxhjy', 'shenzhen-code-lab-bootcamp', 'Code Lab — Web Development Bootcamp', 'A part-time coding bootcamp with a student rate and a project-based final assessment.', 'A part-time web development bootcamp running over sixteen weeks, designed to sit alongside a degree. Covers front-end fundamentals, back-end services and deployment, assessed on a project rather than an examination. A student rate is available on proof of enrolment. Applications and payment are handled by the provider.', 'Technology', 'DIGITAL'::"StudyEssentialFormat", 'PARTNER'::"StudyEssentialSource", 'PUBLISHED'::"StudyEssentialStatus", NULL, 'CNY', 'Code Lab Shenzhen', 'https://example.org/code-lab', NULL, '💻', ARRAY['Sixteen weeks, part-time', 'Project-based assessment', 'Student rate on proof of enrolment']::text[], 130, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "shortDescription" = EXCLUDED."shortDescription",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "format" = EXCLUDED."format",
  "source" = EXCLUDED."source",
  "status" = EXCLUDED."status",
  "priceMinor" = EXCLUDED."priceMinor",
  "currency" = EXCLUDED."currency",
  "providerName" = EXCLUDED."providerName",
  "externalUrl" = EXCLUDED."externalUrl",
  "coverEmoji" = EXCLUDED."coverEmoji",
  "highlights" = EXCLUDED."highlights",
  "sortOrder" = EXCLUDED."sortOrder",
  "publishedAt" = COALESCE("StudyEssential"."publishedAt", EXCLUDED."publishedAt"),
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssential" ("id", "slug", "title", "shortDescription", "description", "category", "format", "source", "status", "priceMinor", "currency", "providerName", "externalUrl", "imageUrl", "coverEmoji", "highlights", "sortOrder", "publishedAt", "createdAt", "updatedAt")
VALUES ('cmsdmfnos000d829pi9d8x4qp', 'career-preparation-guide-partner', 'Career Preparation Guide for Graduates in China', 'CV conventions, interview practice and work-permit basics for graduating internationally.', 'A career guide for international students finishing a degree in China: CV and cover-letter conventions used by Chinese employers, interview formats, salary expectations by city, and an overview of the work-permit categories a graduate can apply for. Distributed by the partner on their careers platform.', 'Career', 'DIGITAL'::"StudyEssentialFormat", 'PARTNER'::"StudyEssentialSource", 'PUBLISHED'::"StudyEssentialStatus", NULL, 'CNY', 'Bridge Careers', 'https://example.org/career-preparation', NULL, '💼', ARRAY['CV conventions for Chinese employers', 'Salary expectations by city', 'Work-permit categories explained']::text[], 140, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "shortDescription" = EXCLUDED."shortDescription",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "format" = EXCLUDED."format",
  "source" = EXCLUDED."source",
  "status" = EXCLUDED."status",
  "priceMinor" = EXCLUDED."priceMinor",
  "currency" = EXCLUDED."currency",
  "providerName" = EXCLUDED."providerName",
  "externalUrl" = EXCLUDED."externalUrl",
  "coverEmoji" = EXCLUDED."coverEmoji",
  "highlights" = EXCLUDED."highlights",
  "sortOrder" = EXCLUDED."sortOrder",
  "publishedAt" = COALESCE("StudyEssential"."publishedAt", EXCLUDED."publishedAt"),
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssential" ("id", "slug", "title", "shortDescription", "description", "category", "format", "source", "status", "priceMinor", "currency", "providerName", "externalUrl", "imageUrl", "coverEmoji", "highlights", "sortOrder", "publishedAt", "createdAt", "updatedAt")
VALUES ('cmsdmfnot000e829pdlycknjg', 'scholarship-application-masterclass', 'Scholarship Application Masterclass', 'Recorded sessions on CSC and university scholarship applications, with annotated examples.', 'Recorded masterclass sessions covering the Chinese Government Scholarship and university-level schemes: eligibility, choosing a supervisor, the study plan, reference letters and timing. Includes annotated examples of successful applications. Access is granted on the partner''s platform.', 'Scholarships', 'DIGITAL'::"StudyEssentialFormat", 'PARTNER'::"StudyEssentialSource", 'PUBLISHED'::"StudyEssentialStatus", NULL, 'CNY', 'Study Path Advisors', 'https://example.org/scholarship-masterclass', NULL, '🏅', ARRAY['CSC and university schemes', 'Study plan and supervisor guidance', 'Annotated successful applications']::text[], 150, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "shortDescription" = EXCLUDED."shortDescription",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "format" = EXCLUDED."format",
  "source" = EXCLUDED."source",
  "status" = EXCLUDED."status",
  "priceMinor" = EXCLUDED."priceMinor",
  "currency" = EXCLUDED."currency",
  "providerName" = EXCLUDED."providerName",
  "externalUrl" = EXCLUDED."externalUrl",
  "coverEmoji" = EXCLUDED."coverEmoji",
  "highlights" = EXCLUDED."highlights",
  "sortOrder" = EXCLUDED."sortOrder",
  "publishedAt" = COALESCE("StudyEssential"."publishedAt", EXCLUDED."publishedAt"),
  "updatedAt" = CURRENT_TIMESTAMP;

-- Readable content for the Kondo digital titles.

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mmx0001slxdj1z7ui3q', "StudyEssential"."id", 1, 'Before you start: choosing your level', 'Most students pick an HSK level from the number of characters they recognise, which is the wrong measure. The examination tests recognition under time pressure, listening at natural speed, and — from HSK 4 — the ability to produce written sentences.

Start with the diagnostic at the end of this chapter. Take it without a dictionary and without pausing the audio. Score yourself honestly. If you are between two levels, prepare for the lower one and sit the higher paper: the confidence you gain from a comfortable pass is worth more than a marginal one.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'hsk-complete-preparation-guide'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mmx0002slxd8c29cmor', "StudyEssential"."id", 2, 'Vocabulary that actually appears', 'The official word lists are long, and not every word carries the same weight. Roughly a fifth of the vocabulary accounts for most of what appears in reading passages, because examiners build passages around everyday situations: renting, travelling, studying, seeing a doctor.

Learn words in the situations they belong to rather than alphabetically. A word met inside a sentence about registering at a university is remembered; the same word met in a column of two hundred is not.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'hsk-complete-preparation-guide'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mmx0003slxdrjrk2g91', "StudyEssential"."id", 3, 'Listening at natural speed', 'Listening is the section international students lose most marks on, and the reason is rarely vocabulary. It is that the audio does not pause where a learner expects a pause.

Train with material played once, at full speed, with no transcript on the first pass. Write down only what you caught. Then replay with the transcript and mark the gap between what was said and what you heard. That gap, not the word list, is your syllabus.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'hsk-complete-preparation-guide'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mmx0004slxd33nmt6xw', "StudyEssential"."id", 4, 'The written paper', 'From HSK 4 the paper asks you to produce language, not only recognise it. Marks come from sentences that are complete and correct, not from sentences that are ambitious.

Build a small set of reliable structures you can write without hesitation, and use them. A paper made of correct simple sentences scores better than one made of half-finished complex ones.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'hsk-complete-preparation-guide'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mmy0005slxdvupry5no', "StudyEssential"."id", 5, 'The last two weeks', 'Stop learning new vocabulary two weeks before the examination. The words will not settle in time and the effort is better spent elsewhere.

Use the remaining time on full mock papers, taken at the hour of your real examination, in one sitting, with no interruptions. You are training stamina and timing now, not knowledge.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'hsk-complete-preparation-guide'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mn00007slxd6uy53fa9', "StudyEssential"."id", 1, 'The first week', 'Campus registration, the residence permit and the health check all have their own queues and their own deadlines, and they do not wait for each other. The residence permit is the one with legal consequences: you have thirty days from entry.

Go to the international student office on your first working day, even if you have nothing to hand in. Ask for the list of deadlines that apply to your programme and write them down. Nobody will chase you.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'chinese-university-survival-handbook'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mn00008slxdh1vr80p4', "StudyEssential"."id", 2, 'Residence permit and the health check', 'The health check must be done at a designated public facility; a report from a private clinic is usually refused. Bring your passport, admission letter and passport photographs, and go early — the examination is done fasting.

The residence permit application follows the health check. Budget two visits to the exit-entry bureau, and do not book travel until the permit is in your passport.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'chinese-university-survival-handbook'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mn00009slxdj3lk7je7', "StudyEssential"."id", 3, 'Course selection and the campus intranet', 'Course selection usually happens on an internal system that opens for a short window and is not translated. Ask a second-year student from your programme to sit with you the first time; this saves more trouble than any guide.

Screenshot your selected courses once the window closes. Systems change and screenshots settle disputes.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'chinese-university-survival-handbook'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mn0000aslxdt0kz15cp', "StudyEssential"."id", 4, 'Money, phones and daily life', 'A Chinese bank account and a phone number registered in your name unlock nearly everything else — payments, deliveries, campus services. Open the account before you need it, not when you do.

Keep a small amount of cash for the first days. Not everything works before your account is active.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'chinese-university-survival-handbook'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mn2000cslxd370f216o', "StudyEssential"."id", 1, 'What an academic argument is', 'An academic argument is a claim you defend with evidence, in an order a reader can follow. It is not a summary of what has been read, and it is not an opinion.

Most weak drafts fail at the claim: they describe a topic instead of asserting something about it. Before writing, put your claim in one sentence. If you cannot, the reading is not finished.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'academic-writing-guide'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mn2000dslxdnnf8n7fi', "StudyEssential"."id", 2, 'Structure that carries the reader', 'A paragraph does one job. It opens by saying what it will establish, establishes it, and closes by connecting to the next.

When a paragraph does two jobs, split it. When it does none, cut it. This single habit improves more drafts than any advice about vocabulary.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'academic-writing-guide'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mn2000eslxdwirqs5wc', "StudyEssential"."id", 3, 'Citation without anxiety', 'Cite when the idea is not yours, when the wording is not yours, and when a reader might want to check. Chinese universities vary in the style they require, so ask your department rather than guessing.

Keep a reference as soon as you read the source. Reconstructing citations at the end is where most accidental plagiarism happens.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'academic-writing-guide'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mn2000fslxd3haydakv', "StudyEssential"."id", 4, 'Editing your own work', 'Edit in passes, each with one purpose: argument, then structure, then sentences, then references. Trying to fix everything at once fixes nothing well.

Read the draft aloud for the sentence pass. A sentence you cannot say comfortably is one your reader will stumble over.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'academic-writing-guide'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mn4000hslxdxgssjrdi', "StudyEssential"."id", 1, 'Python you actually need', 'You do not need all of Python to start. You need lists, dictionaries, functions, and enough understanding of imports to read someone else''s code.

Write small programs that do something real from the first week: read a file, count something, print a summary. Reading tutorials without writing code produces the feeling of progress without the fact of it.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'ai-engineering-starter-pack'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mn4000islxd2vq9a1dy', "StudyEssential"."id", 2, 'Working with data', 'Most of the work in a machine-learning project is preparing data, and most beginners underestimate this by an order of magnitude.

Learn to load a dataset, inspect it, find the missing values and decide what to do about them. A model trained on data you have not looked at will teach you nothing about the problem.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'ai-engineering-starter-pack'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mn4000jslxd208fcnr9', "StudyEssential"."id", 3, 'Your first model', 'Start with a model simple enough to explain to a classmate. Linear and tree-based models are not toys — they are strong baselines that a neural network often fails to beat.

Always compare against the simplest reasonable answer. A model that cannot beat ''predict the average'' is not a model.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'ai-engineering-starter-pack'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mn4000kslxdn4g836gn', "StudyEssential"."id", 4, 'Neural networks, briefly', 'A neural network is a stack of simple functions whose parameters are adjusted to reduce an error. The ideas that matter early are the loss, the optimiser and overfitting.

Train on a small dataset first so a full run takes seconds. Fast feedback is worth more than a large experiment you run once.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'ai-engineering-starter-pack'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mn4000lslxd3tkiuedu', "StudyEssential"."id", 5, 'Deploying something you can show', 'A project nobody can run is hard to put on an application. Package your model behind a small interface, write a short README, and make sure a stranger can start it.

The goal of this chapter is not scale. It is that a supervisor or an employer can open a link and see your work.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'ai-engineering-starter-pack'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mn7000nslxdv0yho6d4', "StudyEssential"."id", 1, 'Framing a question', 'A research question is narrow enough to answer and open enough to be worth asking. ''What is machine learning'' is neither.

Write your question, then write what an answer would look like. If you cannot describe the answer''s shape, narrow the question.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'research-paper-guide'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mn7000oslxd778haze5', "StudyEssential"."id", 2, 'The literature review', 'A literature review is an argument about a field, not a list of papers. It says: here is what is known, here is what is disputed, here is the gap this work addresses.

Read the most-cited paper first and follow its references backwards. This finds the conversation faster than a keyword search.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'research-paper-guide'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mn7000pslxdlxqc69yg', "StudyEssential"."id", 3, 'Working with your supervisor', 'Expectations differ. In many Chinese departments a supervisor expects to be shown work regularly and briefly, rather than a finished draft at the end.

Agree at the first meeting how often you will meet, what you will bring, and how authorship will be handled. Writing this down prevents most of the problems international students report.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'research-paper-guide'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "StudyEssentialChapter" ("id", "essentialId", "position", "title", "body", "createdAt", "updatedAt")
SELECT 'cmsdo8mn7000qslxd1dchb0x5', "StudyEssential"."id", 4, 'Preparing to submit', 'Match the target venue''s format before the final read, not after: reformatting late introduces errors in exactly the places nobody re-checks.

Give yourself one full day between finishing and submitting. Everything you find on that day, you would otherwise have found after submission.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudyEssential" WHERE "StudyEssential"."slug" = 'research-paper-guide'
ON CONFLICT ("essentialId", "position") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "updatedAt" = CURRENT_TIMESTAMP;
