-- The initial Kondo Guide content pack.
--
-- Supplied by the Kondo team and loaded exactly as supplied. Every published
-- entry is NEEDS_REVIEW and none carries a lastVerifiedAt, because the author
-- could not open the source pages. A named editor opens each URL, confirms the
-- steps, and sets the date; that act is what makes something VERIFIED, not the
-- writing of it.
--
-- Sources are recorded only where a real URL was supplied. Three guides arrived
-- with placeholders ("insert arrival airport official URL"); a row reading
-- "(insert ...)" would be a fabricated citation, so those ship with none.
--
-- The emergency guide is loaded as DRAFT and unpublished, on the pack's own
-- instruction: it must not go live until an official source for the numbers is
-- opened and quoted.
--
-- Idempotent: every insert is guarded on slug, so re-running changes nothing.
-- Superseded guides are ARCHIVED, never deleted — deletion cascades through
-- GuideStep to GuideProgress and would destroy students' checklist progress.

DO $$
DECLARE
  author_id TEXT;
  guide_id TEXT;
BEGIN
  SELECT "id" INTO author_id FROM "User"
   WHERE "role" = 'SUPER_ADMIN' ORDER BY "createdAt" ASC LIMIT 1;
  IF author_id IS NULL THEN
    RAISE NOTICE 'No SUPER_ADMIN user; skipping guide content pack.';
    RETURN;
  END IF;


  IF NOT EXISTS (SELECT 1 FROM "Guide" WHERE "slug" = 'apply-for-your-residence-permit') THEN
    guide_id := gen_random_uuid()::text;
    INSERT INTO "Guide" ("id","slug","title","summary","category","estimatedMinutes","published","featured","contentStatus","reviewDueAt","createdById","publishedAt","createdAt","updatedAt")
    VALUES (guide_id, 'apply-for-your-residence-permit', 'Apply for your residence permit', 'After entering China on a student visa, register your address with the local police station and apply for a residence permit before the deadline. Missing the deadline has legal consequences.', 'RESIDENCY'::"GuideCategory", 20, true, false, 'NEEDS_REVIEW'::"GuideContentStatus", '2027-02-16'::timestamp, author_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 0, 'Confirm your local entry/exit office rules', 'Use the National Immigration Administration site or your university''s international student office to find the correct local Exit-Entry Administration service center. Local appointment systems and requirements differ by city.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 1, 'Complete police registration at your residence', 'Ask your university whether they file this for you. If not, go to the police station covering your address with the documents listed by that station or university. Keep the registration certificate or receipt.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 2, 'Prepare the residence permit application with your university', 'Work through the international student office first. They can tell you what the local office currently requires and whether you need a medical check or university letter.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 3, 'Submit at the Exit-Entry office before the deadline', 'Do not leave this until the final day. Missing documents, appointment issues, or medical check delays are common.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideSource" ("id","guideId","title","url","organization","isOfficial","sortOrder","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 'National Immigration Administration official English site', 'https://en.nia.gov.cn/', 'National Immigration Administration, P.R. China', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "Guide" WHERE "slug" = 'set-up-alipay') THEN
    guide_id := gen_random_uuid()::text;
    INSERT INTO "Guide" ("id","slug","title","summary","category","estimatedMinutes","published","featured","contentStatus","reviewDueAt","createdById","publishedAt","createdAt","updatedAt")
    VALUES (guide_id, 'set-up-alipay', 'Set up Alipay and link a foreign card', 'Alipay is the most useful payment app for a new student in China. Many foreign cards work, but card acceptance changes; set up and test before you arrive.', 'MONEY'::"GuideCategory", 20, true, false, 'NEEDS_REVIEW'::"GuideContentStatus", '2027-02-16'::timestamp, author_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 0, 'Download the official Alipay app and register', 'Use the official app store version for your phone. Register with your real identity and a phone number you can receive SMS on.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 1, 'Add a foreign card', 'Try a Visa, Mastercard, JCB, or another card the app shows as supported. If one card is rejected, try another card from a different issuing bank.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 2, 'Complete identity verification if prompted', 'Alipay may require passport information or a face scan. Do this before you need to pay a deposit, taxi, or shop.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 3, 'Do a small real payment', 'Test with a small transaction before leaving home or as soon as possible after arrival. This catches blocked cards while you still have alternatives.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideSource" ("id","guideId","title","url","organization","isOfficial","sortOrder","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 'Alipay official global/international help center', 'https://global.alipay.com/', 'Alipay / Ant Group', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "Guide" WHERE "slug" = 'set-up-wechat-and-wechat-pay') THEN
    guide_id := gen_random_uuid()::text;
    INSERT INTO "Guide" ("id","slug","title","summary","category","estimatedMinutes","published","featured","contentStatus","reviewDueAt","createdById","publishedAt","createdAt","updatedAt")
    VALUES (guide_id, 'set-up-wechat-and-wechat-pay', 'Set up WeChat and WeChat Pay', 'WeChat is needed for daily communication, and WeChat Pay is widely used. Foreign card support is less predictable than Alipay, so set it up early and test.', 'MONEY'::"GuideCategory", 20, true, false, 'NEEDS_REVIEW'::"GuideContentStatus", '2027-02-16'::timestamp, author_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 0, 'Install WeChat and register with a phone number you control', 'WeChat accounts are tied to identity and can be locked if you use someone else''s number or account.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 1, 'Open WeChat Pay and add a bank card', 'If the wallet or card option is hidden, your account may not yet be eligible. Add a foreign card only after the wallet is active.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 2, 'Complete real-name verification', 'WeChat Pay requires identity verification. Failure here is a common reason payments fail later.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 3, 'Test with a small payment', 'Ask someone to send you a small amount or try a small official payment. If the card fails, contact the issuing bank to confirm international/online transactions are enabled.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideSource" ("id","guideId","title","url","organization","isOfficial","sortOrder","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 'WeChat Pay official site', 'https://pay.weixin.qq.com/', 'Tencent / WeChat Pay', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "Guide" WHERE "slug" = 'first-week-in-china') THEN
    guide_id := gen_random_uuid()::text;
    INSERT INTO "Guide" ("id","slug","title","summary","category","estimatedMinutes","published","featured","contentStatus","reviewDueAt","createdById","publishedAt","createdAt","updatedAt")
    VALUES (guide_id, 'first-week-in-china', 'First week in China', 'The order of the first week matters: phone number first, then payments, then university registration, then police registration and residence permit. Many later steps require a Chinese phone number.', 'ARRIVAL'::"GuideCategory", 30, true, false, 'NEEDS_REVIEW'::"GuideContentStatus", '2027-08-16'::timestamp, author_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 0, 'Buy a SIM card at an official carrier store', 'Bring your passport and use an official China Mobile, China Unicom, or China Telecom store. Test mobile data before leaving the store.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 1, 'Set up Alipay and WeChat with the new number', 'Complete identity checks and try a small payment while you have store Wi-Fi or a good connection.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 2, 'Complete university registration and get your student ID', 'Follow the university''s admitted-student checklist. Get proof of enrollment; you may need it for the residence permit and bank account.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 3, 'Do police registration and confirm the residence permit timeline', 'Ask the international student office whether they file the police registration for you. Do this in the first few days.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideSource" ("id","guideId","title","url","organization","isOfficial","sortOrder","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 'National Immigration Administration official English site', 'https://en.nia.gov.cn/', 'National Immigration Administration, P.R. China', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "Guide" WHERE "slug" = 'before-you-fly-checklist') THEN
    guide_id := gen_random_uuid()::text;
    INSERT INTO "Guide" ("id","slug","title","summary","category","estimatedMinutes","published","featured","contentStatus","reviewDueAt","createdById","publishedAt","createdAt","updatedAt")
    VALUES (guide_id, 'before-you-fly-checklist', 'Before you fly checklist', 'Check visa and passport validity, prepare payment cards, store documents offline, and save a contact who can help after landing.', 'BEFORE_DEPARTURE'::"GuideCategory", 20, true, false, 'NEEDS_REVIEW'::"GuideContentStatus", '2027-02-16'::timestamp, author_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 0, 'Check your visa and passport validity', 'Confirm the validity period against the Chinese visa application center or embassy page. Do not rely on memory.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 1, 'Store scans of every important document', 'Keep offline copies of your passport, visa, admission letter, insurance, and any visa-supporting forms your university lists.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 2, 'Set up payment and banking before departure', 'Add a foreign card to Alipay/WeChat and tell your home bank you will travel. Carry two physical cards from different issuers.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 3, 'Download offline tools before you leave', 'Download offline maps, a Chinese dictionary, and any university directions. Do not rely on app stores or blocked services working after landing.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 4, 'Save your destination address and emergency contact in Chinese', 'Store the university address in Chinese characters for taxis, hotels, and registration forms. Store your university''s contact and your country''s embassy contact.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideSource" ("id","guideId","title","url","organization","isOfficial","sortOrder","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 'Chinese Visa Application Service Center', 'https://www.visaforchina.cn/', 'Chinese Visa Application Service Center', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideSource" ("id","guideId","title","url","organization","isOfficial","sortOrder","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 'National Immigration Administration official English site', 'https://en.nia.gov.cn/', 'National Immigration Administration, P.R. China', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "Guide" WHERE "slug" = 'airport-to-campus') THEN
    guide_id := gen_random_uuid()::text;
    INSERT INTO "Guide" ("id","slug","title","summary","category","estimatedMinutes","published","featured","contentStatus","reviewDueAt","createdById","publishedAt","createdAt","updatedAt")
    VALUES (guide_id, 'airport-to-campus', 'Airport to campus', 'Choose university pickup, official taxi, or rail before landing. Have the campus address in Chinese and avoid unofficial drivers inside the terminal.', 'TRANSPORT'::"GuideCategory", 15, true, false, 'NEEDS_REVIEW'::"GuideContentStatus", '2027-08-16'::timestamp, author_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 0, 'Check whether your university offers pickup', 'University pickup is the safest option if the timing matches. Confirm the meeting point and contact number before departure.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 1, 'Prepare the campus address in Chinese characters', 'Keep it on paper or in an offline notes app. Taxi drivers and station staff may not read English.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 2, 'Use the official taxi rank or airport express', 'Follow signs to the official taxi rank or metro. Do not accept rides from people who approach you inside the terminal.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 3, 'Have a backup payment method', 'Have some local cash until your payment apps are working. If using a card, check before the trip whether the taxi or train accepts it.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "Guide" WHERE "slug" = 'university-registration-and-student-id') THEN
    guide_id := gen_random_uuid()::text;
    INSERT INTO "Guide" ("id","slug","title","summary","category","estimatedMinutes","published","featured","contentStatus","reviewDueAt","createdById","publishedAt","createdAt","updatedAt")
    VALUES (guide_id, 'university-registration-and-student-id', 'University registration and student ID', 'Registration steps, dates, and document lists are university-specific. Follow your own university''s admitted-student guide, not another university''s checklist.', 'UNIVERSITY'::"GuideCategory", 20, true, false, 'NEEDS_REVIEW'::"GuideContentStatus", '2027-08-16'::timestamp, author_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 0, 'Read your university''s admitted-student registration guide', 'The official university page lists the location, date, and document checklist. Use that page as the source.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 1, 'Bring the documents the university lists', 'Do not rely on memory or another school''s list. Carry extra passport photos if the guide says they are required.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 2, 'Get your student ID and campus card', 'Ask whether the card is printed immediately or takes days. It may also control dormitory, library, or campus access.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 3, 'Ask about police registration and residence permit support', 'Many universities batch these applications. Confirm deadlines and whether the international office needs your passport.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "Guide" WHERE "slug" = 'trains-and-12306') THEN
    guide_id := gen_random_uuid()::text;
    INSERT INTO "Guide" ("id","slug","title","summary","category","estimatedMinutes","published","featured","contentStatus","reviewDueAt","createdById","publishedAt","createdAt","updatedAt")
    VALUES (guide_id, 'trains-and-12306', 'Trains and 12306', '12306 is the official China Railway booking service. Register with your passport exactly as it appears, and arrive early for first-time passport ID checks.', 'TRANSPORT'::"GuideCategory", 15, true, false, 'NEEDS_REVIEW'::"GuideContentStatus", '2027-08-16'::timestamp, author_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 0, 'Register on the official 12306 app or website', 'Use the official 12306 platform and register with your passport name exactly as it appears. Third-party apps may add fees or fail at the gate.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 1, 'Add passenger information before you need to book', 'Add yourself and any travel companions early. Verification may take time or require a passport scan.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 2, 'Book and pay', 'Use the payment methods 12306 offers. If a foreign card is rejected, try another card or a Chinese bank card if already opened.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 3, 'Use e-ticket or collect with your passport', 'Many stations now support passport-based e-tickets; otherwise go to a ticket window with your passport. Arrive early for first-time ID checks.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideSource" ("id","guideId","title","url","organization","isOfficial","sortOrder","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 'China Railway 12306 official English site', 'https://www.12306.cn/en/index.html', 'China State Railway Group', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "Guide" WHERE "slug" = 'open-a-bank-account-in-china') THEN
    guide_id := gen_random_uuid()::text;
    INSERT INTO "Guide" ("id","slug","title","summary","category","estimatedMinutes","published","featured","contentStatus","reviewDueAt","createdById","publishedAt","createdAt","updatedAt")
    VALUES (guide_id, 'open-a-bank-account-in-china', 'Open a Chinese bank account', 'A local bank account makes Alipay/WeChat, rent deposits, and cash withdrawals easier. Branch requirements vary, so use a branch near campus that knows student applications.', 'MONEY'::"GuideCategory", 25, true, false, 'NEEDS_REVIEW'::"GuideContentStatus", '2027-02-16'::timestamp, author_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 0, 'Choose a bank branch near campus', 'A branch close to the university may be more familiar with student document checks.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 1, 'Bring the identity, enrollment, and phone-number items the branch lists', 'Do not assume one bank''s list applies to another. The branch may ask for a police registration form or residence permit.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 2, 'Complete the account-opening form', 'If the form is only in Chinese, ask bank staff to help. Ensure your name matches your passport exactly.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 3, 'Activate online banking and link the card to Alipay/WeChat', 'Ask the bank to enable online payment and confirm the phone number matches your payment apps. Test a small transfer or payment before leaving.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideSource" ("id","guideId","title","url","organization","isOfficial","sortOrder","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 'People''s Bank of China official English site', 'http://www.pbc.gov.cn/', 'People''s Bank of China', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "Guide" WHERE "slug" = 'sim-card-and-mobile-data') THEN
    guide_id := gen_random_uuid()::text;
    INSERT INTO "Guide" ("id","slug","title","summary","category","estimatedMinutes","published","featured","contentStatus","reviewDueAt","createdById","publishedAt","createdAt","updatedAt")
    VALUES (guide_id, 'sim-card-and-mobile-data', 'SIM card and mobile data', 'Buy a Chinese SIM at an official carrier store with your passport, choose a data plan, and test mobile data before leaving the store.', 'DAILY_LIFE'::"GuideCategory", 15, true, false, 'NEEDS_REVIEW'::"GuideContentStatus", '2027-08-16'::timestamp, author_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 0, 'Go to an official carrier store', 'China Mobile, China Unicom, and China Telecom are the main carriers. Airport counters are convenient but may have fewer plan options.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 1, 'Bring the ID required for real-name registration', 'Chinese SIM cards require real-name registration. Use an official store, not an unofficial seller.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 2, 'Choose a data plan', 'Ask for a plan with enough data and check whether it includes international calling if needed.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 3, 'Test before leaving', 'Turn off Wi-Fi and load a page or map. If it does not work, have staff check activation or APN settings.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideSource" ("id","guideId","title","url","organization","isOfficial","sortOrder","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 'China Mobile official site', 'https://www.chinamobile.com/en/', 'China Mobile', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideSource" ("id","guideId","title","url","organization","isOfficial","sortOrder","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 'China Unicom official site', 'https://www.chinaunicom.com.cn/', 'China Unicom', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "Guide" WHERE "slug" = 'emergency-contacts-and-what-to-do') THEN
    guide_id := gen_random_uuid()::text;
    INSERT INTO "Guide" ("id","slug","title","summary","category","estimatedMinutes","published","featured","contentStatus","reviewDueAt","createdById","publishedAt","createdAt","updatedAt")
    VALUES (guide_id, 'emergency-contacts-and-what-to-do', 'Emergency contacts and what to do', 'Know the national emergency numbers, your university''s 24-hour contact, and which identity/insurance documents to carry.', 'HEALTH'::"GuideCategory", 10, false, false, 'DRAFT'::"GuideContentStatus", '2027-02-16'::timestamp, author_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 0, 'Save the national emergency numbers only after confirming an official source', 'Do not publish numbers from memory. Confirm the official government source for police, ambulance, and fire numbers before this step goes live.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 1, 'Save your university''s 24-hour contact', 'The international office may have a duty phone. Store it in your phone and on paper.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 2, 'Know what to say if you cannot speak Chinese', 'Show a saved Chinese phrase with your location and emergency. Use the university contact if the situation is not life-threatening.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "GuideStep" ("id","guideId","order","title","content","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, guide_id, 3, 'Carry identity and insurance information', 'Keep a copy of your passport and insurance card or policy number. Hospitals may ask for identity and payment/insurance details.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;

  -- Superseded by the pack. Archived, not deleted.
  UPDATE "Guide" SET "contentStatus" = 'ARCHIVED', "updatedAt" = CURRENT_TIMESTAMP
   WHERE "slug" IN ('residence-permit-without-the-panic', 'open-a-chinese-bank-account', 'first-72-hours-in-china')
     AND "contentStatus" <> 'ARCHIVED';
END $$;
