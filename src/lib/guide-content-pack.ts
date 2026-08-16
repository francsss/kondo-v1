/**
 * The initial Kondo Guide content pack.
 *
 * Supplied by the Kondo team, and loaded exactly as supplied. Every entry is
 * NEEDS_REVIEW: the author could not open the source pages, so no guide claims
 * a verification it has not had and none carries a `lastVerifiedAt`. A named
 * editor opens each URL, confirms the steps still match, and sets the date —
 * that act is what turns one of these into VERIFIED, not the writing of it.
 *
 * Two rules were applied when loading, both from the pack's own notes:
 *
 *   - A source is only recorded when it has a real URL. Three entries arrived
 *     with placeholders ("insert arrival airport official URL"). A row reading
 *     "(insert …)" would be a fabricated citation, so those guides ship with no
 *     sources at all and say so through their NEEDS_REVIEW status.
 *
 *   - The emergency guide is not published. Its own note says it must not go
 *     live until an official source for the numbers has been opened, and its
 *     first step is an instruction to the editor rather than to a student.
 *     It is loaded as DRAFT so it is invisible to readers but editable.
 *
 * The VPN entry in the pack was a placeholder with no steps and no source. An
 * empty guide is worse than an absent one, so it was not created.
 */

export type GuideContentStatusSeed = "NEEDS_REVIEW" | "DRAFT";

export type GuideSourceSeed = {
  title: string;
  url: string;
  organization: string;
  isOfficial: boolean;
};

export type GuideSeed = {
  slug: string;
  title: string;
  summary: string;
  category:
    | "BEFORE_DEPARTURE"
    | "ARRIVAL"
    | "RESIDENCY"
    | "DAILY_LIFE"
    | "MONEY"
    | "TRANSPORT"
    | "HEALTH"
    | "UNIVERSITY";
  estimatedMinutes: number;
  status: GuideContentStatusSeed;
  published: boolean;
  /** ISO date the pack asked for the next review. */
  reviewBy: string;
  steps: Array<{ title: string; content: string }>;
  sources: GuideSourceSeed[];
};

const NIA: GuideSourceSeed = {
  title: "National Immigration Administration official English site",
  url: "https://en.nia.gov.cn/",
  organization: "National Immigration Administration, P.R. China",
  isOfficial: true,
};

export const GUIDE_CONTENT_PACK: GuideSeed[] = [
  {
    slug: "apply-for-your-residence-permit",
    title: "Apply for your residence permit",
    summary:
      "After entering China on a student visa, register your address with the local police station and apply for a residence permit before the deadline. Missing the deadline has legal consequences.",
    category: "RESIDENCY",
    estimatedMinutes: 20,
    status: "NEEDS_REVIEW",
    published: true,
    reviewBy: "2027-02-16",
    steps: [
      {
        title: "Confirm your local entry/exit office rules",
        content:
          "Use the National Immigration Administration site or your university's international student office to find the correct local Exit-Entry Administration service center. Local appointment systems and requirements differ by city.",
      },
      {
        title: "Complete police registration at your residence",
        content:
          "Ask your university whether they file this for you. If not, go to the police station covering your address with the documents listed by that station or university. Keep the registration certificate or receipt.",
      },
      {
        title: "Prepare the residence permit application with your university",
        content:
          "Work through the international student office first. They can tell you what the local office currently requires and whether you need a medical check or university letter.",
      },
      {
        title: "Submit at the Exit-Entry office before the deadline",
        content:
          "Do not leave this until the final day. Missing documents, appointment issues, or medical check delays are common.",
      },
    ],
    sources: [NIA],
  },
  {
    slug: "set-up-alipay",
    title: "Set up Alipay and link a foreign card",
    summary:
      "Alipay is the most useful payment app for a new student in China. Many foreign cards work, but card acceptance changes; set up and test before you arrive.",
    category: "MONEY",
    estimatedMinutes: 20,
    status: "NEEDS_REVIEW",
    published: true,
    reviewBy: "2027-02-16",
    steps: [
      {
        title: "Download the official Alipay app and register",
        content:
          "Use the official app store version for your phone. Register with your real identity and a phone number you can receive SMS on.",
      },
      {
        title: "Add a foreign card",
        content:
          "Try a Visa, Mastercard, JCB, or another card the app shows as supported. If one card is rejected, try another card from a different issuing bank.",
      },
      {
        title: "Complete identity verification if prompted",
        content:
          "Alipay may require passport information or a face scan. Do this before you need to pay a deposit, taxi, or shop.",
      },
      {
        title: "Do a small real payment",
        content:
          "Test with a small transaction before leaving home or as soon as possible after arrival. This catches blocked cards while you still have alternatives.",
      },
    ],
    sources: [
      {
        title: "Alipay official global/international help center",
        url: "https://global.alipay.com/",
        organization: "Alipay / Ant Group",
        isOfficial: true,
      },
    ],
  },
  {
    slug: "set-up-wechat-and-wechat-pay",
    title: "Set up WeChat and WeChat Pay",
    summary:
      "WeChat is needed for daily communication, and WeChat Pay is widely used. Foreign card support is less predictable than Alipay, so set it up early and test.",
    category: "MONEY",
    estimatedMinutes: 20,
    status: "NEEDS_REVIEW",
    published: true,
    reviewBy: "2027-02-16",
    steps: [
      {
        title: "Install WeChat and register with a phone number you control",
        content:
          "WeChat accounts are tied to identity and can be locked if you use someone else's number or account.",
      },
      {
        title: "Open WeChat Pay and add a bank card",
        content:
          "If the wallet or card option is hidden, your account may not yet be eligible. Add a foreign card only after the wallet is active.",
      },
      {
        title: "Complete real-name verification",
        content:
          "WeChat Pay requires identity verification. Failure here is a common reason payments fail later.",
      },
      {
        title: "Test with a small payment",
        content:
          "Ask someone to send you a small amount or try a small official payment. If the card fails, contact the issuing bank to confirm international/online transactions are enabled.",
      },
    ],
    sources: [
      {
        title: "WeChat Pay official site",
        url: "https://pay.weixin.qq.com/",
        organization: "Tencent / WeChat Pay",
        isOfficial: true,
      },
    ],
  },
  {
    slug: "first-week-in-china",
    title: "First week in China",
    summary:
      "The order of the first week matters: phone number first, then payments, then university registration, then police registration and residence permit. Many later steps require a Chinese phone number.",
    category: "ARRIVAL",
    estimatedMinutes: 30,
    status: "NEEDS_REVIEW",
    published: true,
    reviewBy: "2027-08-16",
    steps: [
      {
        title: "Buy a SIM card at an official carrier store",
        content:
          "Bring your passport and use an official China Mobile, China Unicom, or China Telecom store. Test mobile data before leaving the store.",
      },
      {
        title: "Set up Alipay and WeChat with the new number",
        content:
          "Complete identity checks and try a small payment while you have store Wi-Fi or a good connection.",
      },
      {
        title: "Complete university registration and get your student ID",
        content:
          "Follow the university's admitted-student checklist. Get proof of enrollment; you may need it for the residence permit and bank account.",
      },
      {
        title:
          "Do police registration and confirm the residence permit timeline",
        content:
          "Ask the international student office whether they file the police registration for you. Do this in the first few days.",
      },
    ],
    sources: [NIA],
  },
  {
    slug: "before-you-fly-checklist",
    title: "Before you fly checklist",
    summary:
      "Check visa and passport validity, prepare payment cards, store documents offline, and save a contact who can help after landing.",
    category: "BEFORE_DEPARTURE",
    estimatedMinutes: 20,
    status: "NEEDS_REVIEW",
    published: true,
    reviewBy: "2027-02-16",
    steps: [
      {
        title: "Check your visa and passport validity",
        content:
          "Confirm the validity period against the Chinese visa application center or embassy page. Do not rely on memory.",
      },
      {
        title: "Store scans of every important document",
        content:
          "Keep offline copies of your passport, visa, admission letter, insurance, and any visa-supporting forms your university lists.",
      },
      {
        title: "Set up payment and banking before departure",
        content:
          "Add a foreign card to Alipay/WeChat and tell your home bank you will travel. Carry two physical cards from different issuers.",
      },
      {
        title: "Download offline tools before you leave",
        content:
          "Download offline maps, a Chinese dictionary, and any university directions. Do not rely on app stores or blocked services working after landing.",
      },
      {
        title: "Save your destination address and emergency contact in Chinese",
        content:
          "Store the university address in Chinese characters for taxis, hotels, and registration forms. Store your university's contact and your country's embassy contact.",
      },
    ],
    sources: [
      {
        title: "Chinese Visa Application Service Center",
        url: "https://www.visaforchina.cn/",
        organization: "Chinese Visa Application Service Center",
        isOfficial: true,
      },
      NIA,
    ],
  },
  {
    slug: "airport-to-campus",
    title: "Airport to campus",
    summary:
      "Choose university pickup, official taxi, or rail before landing. Have the campus address in Chinese and avoid unofficial drivers inside the terminal.",
    category: "TRANSPORT",
    estimatedMinutes: 15,
    status: "NEEDS_REVIEW",
    published: true,
    reviewBy: "2027-08-16",
    steps: [
      {
        title: "Check whether your university offers pickup",
        content:
          "University pickup is the safest option if the timing matches. Confirm the meeting point and contact number before departure.",
      },
      {
        title: "Prepare the campus address in Chinese characters",
        content:
          "Keep it on paper or in an offline notes app. Taxi drivers and station staff may not read English.",
      },
      {
        title: "Use the official taxi rank or airport express",
        content:
          "Follow signs to the official taxi rank or metro. Do not accept rides from people who approach you inside the terminal.",
      },
      {
        title: "Have a backup payment method",
        content:
          "Have some local cash until your payment apps are working. If using a card, check before the trip whether the taxi or train accepts it.",
      },
    ],
    // No national source exists and the pack supplied only a placeholder URL.
    sources: [],
  },
  {
    slug: "university-registration-and-student-id",
    title: "University registration and student ID",
    summary:
      "Registration steps, dates, and document lists are university-specific. Follow your own university's admitted-student guide, not another university's checklist.",
    category: "UNIVERSITY",
    estimatedMinutes: 20,
    status: "NEEDS_REVIEW",
    published: true,
    reviewBy: "2027-08-16",
    steps: [
      {
        title: "Read your university's admitted-student registration guide",
        content:
          "The official university page lists the location, date, and document checklist. Use that page as the source.",
      },
      {
        title: "Bring the documents the university lists",
        content:
          "Do not rely on memory or another school's list. Carry extra passport photos if the guide says they are required.",
      },
      {
        title: "Get your student ID and campus card",
        content:
          "Ask whether the card is printed immediately or takes days. It may also control dormitory, library, or campus access.",
      },
      {
        title: "Ask about police registration and residence permit support",
        content:
          "Many universities batch these applications. Confirm deadlines and whether the international office needs your passport.",
      },
    ],
    // University-specific; the pack supplied a placeholder for the real URL.
    sources: [],
  },
  {
    slug: "trains-and-12306",
    title: "Trains and 12306",
    summary:
      "12306 is the official China Railway booking service. Register with your passport exactly as it appears, and arrive early for first-time passport ID checks.",
    category: "TRANSPORT",
    estimatedMinutes: 15,
    status: "NEEDS_REVIEW",
    published: true,
    reviewBy: "2027-08-16",
    steps: [
      {
        title: "Register on the official 12306 app or website",
        content:
          "Use the official 12306 platform and register with your passport name exactly as it appears. Third-party apps may add fees or fail at the gate.",
      },
      {
        title: "Add passenger information before you need to book",
        content:
          "Add yourself and any travel companions early. Verification may take time or require a passport scan.",
      },
      {
        title: "Book and pay",
        content:
          "Use the payment methods 12306 offers. If a foreign card is rejected, try another card or a Chinese bank card if already opened.",
      },
      {
        title: "Use e-ticket or collect with your passport",
        content:
          "Many stations now support passport-based e-tickets; otherwise go to a ticket window with your passport. Arrive early for first-time ID checks.",
      },
    ],
    sources: [
      {
        title: "China Railway 12306 official English site",
        url: "https://www.12306.cn/en/index.html",
        organization: "China State Railway Group",
        isOfficial: true,
      },
    ],
  },
  {
    slug: "open-a-bank-account-in-china",
    title: "Open a Chinese bank account",
    summary:
      "A local bank account makes Alipay/WeChat, rent deposits, and cash withdrawals easier. Branch requirements vary, so use a branch near campus that knows student applications.",
    category: "MONEY",
    estimatedMinutes: 25,
    status: "NEEDS_REVIEW",
    published: true,
    reviewBy: "2027-02-16",
    steps: [
      {
        title: "Choose a bank branch near campus",
        content:
          "A branch close to the university may be more familiar with student document checks.",
      },
      {
        title:
          "Bring the identity, enrollment, and phone-number items the branch lists",
        content:
          "Do not assume one bank's list applies to another. The branch may ask for a police registration form or residence permit.",
      },
      {
        title: "Complete the account-opening form",
        content:
          "If the form is only in Chinese, ask bank staff to help. Ensure your name matches your passport exactly.",
      },
      {
        title: "Activate online banking and link the card to Alipay/WeChat",
        content:
          "Ask the bank to enable online payment and confirm the phone number matches your payment apps. Test a small transfer or payment before leaving.",
      },
    ],
    sources: [
      {
        title: "People's Bank of China official English site",
        url: "http://www.pbc.gov.cn/",
        organization: "People's Bank of China",
        isOfficial: true,
      },
    ],
  },
  {
    slug: "sim-card-and-mobile-data",
    title: "SIM card and mobile data",
    summary:
      "Buy a Chinese SIM at an official carrier store with your passport, choose a data plan, and test mobile data before leaving the store.",
    category: "DAILY_LIFE",
    estimatedMinutes: 15,
    status: "NEEDS_REVIEW",
    published: true,
    reviewBy: "2027-08-16",
    steps: [
      {
        title: "Go to an official carrier store",
        content:
          "China Mobile, China Unicom, and China Telecom are the main carriers. Airport counters are convenient but may have fewer plan options.",
      },
      {
        title: "Bring the ID required for real-name registration",
        content:
          "Chinese SIM cards require real-name registration. Use an official store, not an unofficial seller.",
      },
      {
        title: "Choose a data plan",
        content:
          "Ask for a plan with enough data and check whether it includes international calling if needed.",
      },
      {
        title: "Test before leaving",
        content:
          "Turn off Wi-Fi and load a page or map. If it does not work, have staff check activation or APN settings.",
      },
    ],
    sources: [
      {
        title: "China Mobile official site",
        url: "https://www.chinamobile.com/en/",
        organization: "China Mobile",
        isOfficial: true,
      },
      {
        title: "China Unicom official site",
        url: "https://www.chinaunicom.com.cn/",
        organization: "China Unicom",
        isOfficial: true,
      },
    ],
  },
  {
    slug: "emergency-contacts-and-what-to-do",
    title: "Emergency contacts and what to do",
    summary:
      "Know the national emergency numbers, your university's 24-hour contact, and which identity/insurance documents to carry.",
    category: "HEALTH",
    estimatedMinutes: 10,
    // Unpublished on the pack's own instruction: it must not go live until an
    // official source for the emergency numbers has been opened and quoted.
    status: "DRAFT",
    published: false,
    reviewBy: "2027-02-16",
    steps: [
      {
        title:
          "Save the national emergency numbers only after confirming an official source",
        content:
          "Do not publish numbers from memory. Confirm the official government source for police, ambulance, and fire numbers before this step goes live.",
      },
      {
        title: "Save your university's 24-hour contact",
        content:
          "The international office may have a duty phone. Store it in your phone and on paper.",
      },
      {
        title: "Know what to say if you cannot speak Chinese",
        content:
          "Show a saved Chinese phrase with your location and emergency. Use the university contact if the situation is not life-threatening.",
      },
      {
        title: "Carry identity and insurance information",
        content:
          "Keep a copy of your passport and insurance card or policy number. Hospitals may ask for identity and payment/insurance details.",
      },
    ],
    sources: [],
  },
];

/**
 * Guides the pack supersedes.
 *
 * Archived rather than deleted. Deleting a guide cascades through `GuideStep`
 * to `GuideProgress`, which would destroy every student's checklist
 * completion; ARCHIVED removes it from search, lists and recommendations while
 * that record survives.
 */
export const SUPERSEDED_GUIDE_SLUGS = [
  "residence-permit-without-the-panic",
  "open-a-chinese-bank-account",
  "first-72-hours-in-china",
] as const;
