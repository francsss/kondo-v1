import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  CITY_COORDINATES,
  UNIVERSITY_COORDINATES,
} from "../src/lib/place-coordinates";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import chinaHigherEducation from "./reference-data/china-higher-education-2026.json";
import { COUNTRIES } from "../src/lib/countries";
import { assertDestructiveSeedAllowed } from "../src/lib/seed-safety";
import { getObjectStorage } from "../src/lib/storage";

const prisma = new PrismaClient();
const password = "ChangeMe123!";

async function createDemoListingImage(input: {
  ownerId: string;
  attachmentId: string;
  title: string;
  color: string;
}) {
  const width = 960;
  const height = 720;
  const bytes = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: input.color,
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  const objectKey = `marketplace/demo/${randomUUID()}.jpg`;
  await getObjectStorage().write(objectKey, bytes, "image/jpeg");
  const media = await prisma.mediaAsset.create({
    data: {
      ownerId: input.ownerId,
      objectKey,
      storageProvider: "LOCAL",
      kind: "IMAGE",
      purpose: "LISTING_IMAGE",
      visibility: "PUBLIC",
      status: "ACTIVE",
      scanStatus: "CLEAN",
      originalFileName: "listing.jpg",
      extension: "jpg",
      declaredMime: "image/jpeg",
      detectedMime: "image/jpeg",
      sizeBytes: bytes.byteLength,
      width,
      height,
      altText: input.title,
      checksumSha256: createHash("sha256").update(bytes).digest("hex"),
      uploadExpiresAt: new Date(Date.now() + 60_000),
      uploadedAt: new Date(),
      validatedAt: new Date(),
      attachedAt: new Date(),
      attachmentType: "MARKETPLACE_LISTING",
      attachmentId: input.attachmentId,
    },
  });
  return media;
}

async function clearDatabase() {
  await prisma.analyticsEvent.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.reportNote.deleteMany();
  await prisma.reportEvidence.deleteMany();
  await prisma.report.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.userBlock.deleteMany();
  await prisma.bookmark.deleteMany();
  await prisma.answerVote.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.question.deleteMany();
  await prisma.guideProgress.deleteMany();
  await prisma.guideStep.deleteMany();
  await prisma.guide.deleteMany();
  await prisma.scholarshipFavorite.deleteMany();
  await prisma.scholarship.deleteMany();
  await prisma.scholarshipAgent.deleteMany();
  await prisma.listingFavorite.deleteMany();
  await prisma.listingImage.deleteMany();
  await prisma.marketplaceListing.deleteMany();
  await prisma.marketplaceCategory.deleteMany();
  await prisma.reaction.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  // Organizations reference their human creator with RESTRICT. Delete the
  // organization parent first so workspace memberships, invitations,
  // ownership transfers, verification requests, and aliases cascade before
  // demo users are recreated.
  await prisma.organization.deleteMany();
  // Delete the parent first so PostgreSQL cascades memberships after the
  // owner row is gone. Deleting owner memberships directly is intentionally
  // rejected by the community ownership integrity trigger.
  await prisma.community.deleteMany();
  await prisma.communityMember.deleteMany();
  await prisma.session.deleteMany();
  await prisma.oAuthAccount.deleteMany();
  await prisma.user.deleteMany();
  await prisma.university.deleteMany();
  await prisma.city.deleteMany();
  await prisma.country.deleteMany();
}

async function main() {
  assertDestructiveSeedAllowed();
  await clearDatabase();
  const passwordHash = await bcrypt.hash(password, 12);

  // Every ISO country is seeded, not a regional subset: an international
  // student from any origin has to be able to register and find their people.
  await prisma.country.createMany({
    data: COUNTRIES.map(({ code, name, emoji }) => ({
      code,
      name,
      emoji,
      isActive: true,
      verified: true,
    })),
  });
  const countries = await prisma.country.findMany();
  const country = Object.fromEntries(
    countries.map((item) => [item.code, item]),
  );

  /*
   * Coordinates for a seeded place, from the same reference the app uses.
   *
   * The migration that carries these values runs before any seed does, so on a
   * fresh database — CI, a new environment — it updates nothing and the rows
   * arrive here with null coordinates and Nearby shows no distance. Setting
   * them at creation is what makes a fresh database behave like a real one.
   */
  const cityPoint = (name: string) => CITY_COORDINATES[name] ?? {};
  const universityPoint = (name: string) => UNIVERSITY_COORDINATES[name] ?? {};

  const beijing = await prisma.city.create({
    data: {
      slug: "beijing",
      name: "Beijing",
      ...cityPoint("Beijing"),
      province: "Beijing",
      countryId: country.CN.id,
      isActive: true,
      verified: true,
    },
  });
  const shanghai = await prisma.city.create({
    data: {
      slug: "shanghai",
      name: "Shanghai",
      ...cityPoint("Shanghai"),
      province: "Shanghai",
      countryId: country.CN.id,
      isActive: true,
      verified: true,
    },
  });
  const wuhan = await prisma.city.create({
    data: {
      slug: "wuhan",
      name: "Wuhan",
      ...cityPoint("Wuhan"),
      province: "Hubei",
      countryId: country.CN.id,
      isActive: true,
      verified: true,
    },
  });
  const hangzhou = await prisma.city.create({
    data: {
      slug: "hangzhou",
      name: "Hangzhou",
      ...cityPoint("Hangzhou"),
      province: "Zhejiang",
      countryId: country.CN.id,
      isActive: true,
      verified: true,
    },
  });

  const tsinghua = await prisma.university.create({
    data: {
      slug: "tsinghua-university",
      name: "Tsinghua University",
      ...universityPoint("Tsinghua University"),
      shortName: "THU",
      countryId: country.CN.id,
      cityId: beijing.id,
      verified: true,
    },
  });
  const peking = await prisma.university.create({
    data: {
      slug: "peking-university",
      name: "Peking University",
      ...universityPoint("Peking University"),
      shortName: "PKU",
      countryId: country.CN.id,
      cityId: beijing.id,
      verified: true,
    },
  });
  const wuhanUniversity = await prisma.university.create({
    data: {
      slug: "wuhan-university",
      name: "Wuhan University",
      ...universityPoint("Wuhan University"),
      shortName: "WHU",
      countryId: country.CN.id,
      cityId: wuhan.id,
      verified: true,
    },
  });
  const zhejiang = await prisma.university.create({
    data: {
      slug: "zhejiang-university",
      name: "Zhejiang University",
      ...universityPoint("Zhejiang University"),
      shortName: "ZJU",
      countryId: country.CN.id,
      cityId: hangzhou.id,
      verified: true,
    },
  });

  await prisma.city.createMany({
    data: chinaHigherEducation.cities.map((city) => ({
      id: city.id,
      slug: city.slug,
      name: city.name,
      ...cityPoint(city.name),
      province: city.province,
      countryId: country.CN.id,
      isActive: true,
      verified: true,
    })),
    skipDuplicates: true,
  });
  const importedCities = await prisma.city.findMany({
    where: {
      slug: {
        in: chinaHigherEducation.cities.map((city) => city.slug),
      },
    },
    select: { id: true, slug: true },
  });
  const importedCityBySlug = new Map(
    importedCities.map((city) => [city.slug, city.id]),
  );
  await prisma.university.createMany({
    data: chinaHigherEducation.universities.map((university) => {
      const cityId = importedCityBySlug.get(university.citySlug);
      if (!cityId) {
        throw new Error(
          `Seed reference city is missing for ${university.nativeName}.`,
        );
      }
      return {
        id: university.id,
        slug: university.slug,
        name: university.name,
        ...universityPoint(university.name),
        shortName: university.nativeName,
        countryId: country.CN.id,
        cityId,
        isActive: true,
        verified: true,
      };
    }),
    skipDuplicates: true,
  });

  const userData = [
    {
      email: "admin@kondo.app",
      firstName: "Nana",
      lastName: "Owusu",
      username: "nana-admin",
      role: "SUPER_ADMIN" as const,
      countryId: country.GH.id,
      cityId: beijing.id,
      universityId: tsinghua.id,
      degree: "Platform Operations",
      studyLevel: "MASTERS" as const,
      languages: ["English", "Twi"],
    },
    {
      email: "moderator@kondo.app",
      firstName: "Amina",
      lastName: "Mballa",
      username: "amina-m",
      role: "MODERATOR" as const,
      countryId: country.CM.id,
      cityId: wuhan.id,
      universityId: wuhanUniversity.id,
      degree: "Public Health",
      studyLevel: "MASTERS" as const,
      languages: ["English", "French"],
    },
    {
      email: "ama@example.com",
      firstName: "Ama",
      lastName: "Mensah",
      username: "ama-mensah",
      role: "MEMBER" as const,
      countryId: country.GH.id,
      cityId: beijing.id,
      universityId: tsinghua.id,
      degree: "International Relations",
      studyLevel: "MASTERS" as const,
      languages: ["English", "Twi"],
      interests: ["Community", "Student Guide", "Marketplace"],
    },
    {
      email: "kwame@example.com",
      firstName: "Kwame",
      lastName: "Nkrumah",
      username: "kwame-n",
      role: "MEMBER" as const,
      countryId: country.GH.id,
      cityId: beijing.id,
      universityId: peking.id,
      degree: "Computer Science",
      studyLevel: "DOCTORATE" as const,
      languages: ["English", "Twi"],
    },
    {
      email: "chidi@example.com",
      firstName: "Chidi",
      lastName: "Okafor",
      username: "chidi-o",
      role: "MEMBER" as const,
      countryId: country.NG.id,
      cityId: beijing.id,
      universityId: peking.id,
      degree: "Finance",
      studyLevel: "BACHELORS" as const,
      languages: ["English", "Igbo"],
    },
    {
      email: "wambui@example.com",
      firstName: "Wambui",
      lastName: "Kamau",
      username: "wambui-k",
      role: "MEMBER" as const,
      countryId: country.KE.id,
      cityId: hangzhou.id,
      universityId: zhejiang.id,
      degree: "Biomedical Engineering",
      studyLevel: "MASTERS" as const,
      languages: ["English", "Swahili"],
    },
  ];

  const users = await Promise.all(
    userData.map((data) =>
      prisma.user.create({
        data: {
          ...data,
          gender:
            data.firstName === "Amina" ||
            data.firstName === "Ama" ||
            data.firstName === "Wambui"
              ? "FEMALE"
              : "MALE",
          passwordHash,
          status: "ACTIVE",
          bio: `International student in China studying ${data.degree}. Always happy to share what I learn.`,
          arrivalDate: new Date("2025-09-01"),
          onboardingCompletedAt: new Date(),
          lastActiveAt: new Date(),
        },
      }),
    ),
  );
  const [admin, moderator, ama, kwame, chidi, wambui] = users;
  await prisma.meetDiscoveryProfile.createMany({
    data: users.map((user) => ({
      userId: user.id,
      gender: user.id === ama.id || user.id === wambui.id ? "FEMALE" : "MALE",
      interestedIn: "ALL",
      birthYear: 2000,
      minimumAge: 18,
      maximumAge: 40,
      preferredLanguages: user.languages,
      discoveryCityId: user.cityId,
      discoveryUniversityId: user.universityId,
      lookingFor: [
        "FRIENDS",
        "STUDY",
        "LANGUAGE",
        "SPORTS",
        "CITY",
        "NETWORKING",
        "COUNTRY",
        "RELATIONSHIP",
      ],
      distanceRange: "CITY",
      nearbyVisibility: true,
      showAge: true,
      showNationality: true,
      showUniversity: true,
      showRelationshipStatus: true,
      showLanguages: true,
      showInterests: true,
      completedAt: new Date(),
    })),
  });

  const communityData = [
    {
      slug: "african-students-beijing",
      name: "African Students in Beijing",
      description:
        "Local questions, events, friendships, and practical updates for African students across Beijing.",
      type: "CITY" as const,
      icon: "🏙️",
      cityId: beijing.id,
      isVerified: true,
    },
    {
      slug: "ghanaians-in-china",
      name: "Ghanaians in China",
      description:
        "A home away from home for Ghanaian students across China—culture, opportunities, and community support.",
      type: "COUNTRY" as const,
      icon: "🇬🇭",
      countryId: country.GH.id,
      isVerified: true,
    },
    {
      slug: "pakistanis-in-china",
      name: "Pakistanis in China",
      description:
        "Scholarships, halal food, visas, and city meetups for Pakistani students across China.",
      type: "COUNTRY" as const,
      icon: "🇵🇰",
      countryId: country.PK.id,
      isVerified: true,
    },
    {
      slug: "kazakhstanis-in-china",
      name: "Kazakhstanis in China",
      description:
        "Language exchange, paperwork, and community for students from Kazakhstan studying in China.",
      type: "COUNTRY" as const,
      icon: "🇰🇿",
      countryId: country.KZ.id,
      isVerified: false,
    },
    {
      slug: "tsinghua-community",
      name: "Tsinghua Community",
      description:
        "Campus-specific advice, meetups, course questions, and useful discoveries for Tsinghua students.",
      type: "UNIVERSITY" as const,
      icon: "🎓",
      universityId: tsinghua.id,
      isVerified: true,
    },
    {
      slug: "housing-roommates",
      name: "Housing & Roommates",
      description:
        "Find better housing, understand contracts, share neighborhood advice, and connect with potential roommates.",
      type: "TOPIC" as const,
      icon: "🏠",
      isVerified: true,
    },
    {
      slug: "tech-builders",
      name: "Tech Builders",
      description:
        "Developers, designers, researchers, and founders learning and building together across China.",
      type: "TOPIC" as const,
      icon: "💻",
      isVerified: false,
    },
    {
      slug: "new-to-china",
      name: "New to China",
      description:
        "A welcoming starting point for arrivals, with patient answers to the questions everyone asks in week one.",
      type: "TOPIC" as const,
      icon: "🛬",
      isVerified: true,
    },
  ];

  // Index-parallel with `communityData`.
  const communityOwnerIds = [
    admin.id,
    admin.id,
    admin.id,
    moderator.id,
    admin.id,
    moderator.id,
    kwame.id,
    moderator.id,
  ];
  const communities = await Promise.all(
    communityData.map((data, index) =>
      prisma.community.create({
        data: {
          ...data,
          createdById: admin.id,
          ownerId: communityOwnerIds[index],
          members: {
            create: { userId: communityOwnerIds[index], role: "OWNER" },
          },
        },
      }),
    ),
  );
  const [
    beijingCommunity,
    ghanaCommunity,
    tsinghuaCommunity,
    housingCommunity,
    techCommunity,
    newcomerCommunity,
  ] = communities;

  const memberships = [
    [beijingCommunity.id, admin.id, "OWNER"],
    [beijingCommunity.id, ama.id, "MEMBER"],
    [beijingCommunity.id, kwame.id, "MEMBER"],
    [beijingCommunity.id, chidi.id, "MEMBER"],
    [ghanaCommunity.id, admin.id, "OWNER"],
    [ghanaCommunity.id, ama.id, "MEMBER"],
    [ghanaCommunity.id, kwame.id, "MODERATOR"],
    [tsinghuaCommunity.id, admin.id, "OWNER"],
    [tsinghuaCommunity.id, ama.id, "MEMBER"],
    [housingCommunity.id, moderator.id, "OWNER"],
    [housingCommunity.id, ama.id, "MEMBER"],
    [housingCommunity.id, chidi.id, "MEMBER"],
    [housingCommunity.id, wambui.id, "MEMBER"],
    [techCommunity.id, kwame.id, "OWNER"],
    [techCommunity.id, ama.id, "MEMBER"],
    [techCommunity.id, wambui.id, "MEMBER"],
    [newcomerCommunity.id, moderator.id, "OWNER"],
    [newcomerCommunity.id, ama.id, "MEMBER"],
    [newcomerCommunity.id, chidi.id, "MEMBER"],
  ] as const;
  for (const [communityId, userId, role] of memberships) {
    if (role === "OWNER") continue;
    await prisma.communityMember.create({
      data: { communityId, userId, role },
    });
  }

  const metroPost = await prisma.post.create({
    data: {
      communityId: tsinghuaCommunity.id,
      authorId: kwame.id,
      type: "QUESTION",
      title: "Where do you buy a student metro card?",
      content:
        "Quick update for new arrivals: the service office near the east gate now accepts passports. Go before 4 PM and bring your admission letter plus one photo. The process took me about 20 minutes.",
      pinnedAt: new Date(),
      createdAt: new Date(Date.now() - 2 * 3_600_000),
    },
  });
  const housingPost = await prisma.post.create({
    data: {
      communityId: housingCommunity.id,
      authorId: wambui.id,
      type: "DISCUSSION",
      title: "Three things I wish I checked before signing my lease",
      content:
        "1. Whether heating was included.\n2. Who pays the agency fee.\n3. If my name could be registered at the local police station.\n\nAsk for every answer in writing—even when the landlord seems kind.",
      createdAt: new Date(Date.now() - 8 * 3_600_000),
    },
  });
  const welcomePost = await prisma.post.create({
    data: {
      communityId: newcomerCommunity.id,
      authorId: moderator.id,
      type: "ANNOUNCEMENT",
      title: "New this week? Start with these five things",
      content:
        "Welcome to China! Check your university registration deadline, complete temporary residence registration, activate a local SIM, connect Alipay, and save your international office contact. Ask here if any step gets confusing.",
      pinnedAt: new Date(),
      createdAt: new Date(Date.now() - 24 * 3_600_000),
    },
  });
  const mixerEvent = await prisma.post.create({
    data: {
      communityId: beijingCommunity.id,
      authorId: admin.id,
      type: "EVENT",
      title: "Beijing student mixer",
      content:
        "A relaxed evening for new and returning students. Bring a friend; light food is provided.",
      eventAt: new Date("2026-07-18T18:30:00+08:00"),
      eventLocation: "Wudaokou Community Center",
    },
  });
  await prisma.post.create({
    data: {
      communityId: newcomerCommunity.id,
      authorId: moderator.id,
      type: "EVENT",
      title: "New arrivals Q&A",
      content:
        "Residence permits, SIM cards, bank accounts, and the little questions in between.",
      eventAt: new Date("2026-07-22T19:00:00+08:00"),
      eventLocation: "Online · Kondo Community",
    },
  });
  await prisma.post.create({
    data: {
      communityId: beijingCommunity.id,
      authorId: kwame.id,
      type: "EVENT",
      title: "Campus football day",
      content: "All levels welcome. Teams are made on arrival.",
      eventAt: new Date("2026-07-27T10:00:00+08:00"),
      eventLocation: "Olympic Forest Park",
    },
  });

  const firstComment = await prisma.comment.create({
    data: {
      postId: metroPost.id,
      authorId: ama.id,
      content:
        "This worked for me yesterday—photo booth is also inside the station.",
    },
  });
  await prisma.comment.create({
    data: {
      postId: metroPost.id,
      authorId: chidi.id,
      parentId: firstComment.id,
      content: "Thank you! Did they accept a digital admission letter?",
    },
  });
  await prisma.comment.create({
    data: {
      postId: housingPost.id,
      authorId: moderator.id,
      content:
        "The police registration point is especially important for residence permit renewals.",
    },
  });
  for (const [postId, userId, type] of [
    [metroPost.id, ama.id, "HELPFUL"],
    [metroPost.id, chidi.id, "HELPFUL"],
    [metroPost.id, wambui.id, "LIKE"],
    [housingPost.id, ama.id, "HELPFUL"],
    [welcomePost.id, ama.id, "CELEBRATE"],
    [mixerEvent.id, ama.id, "LIKE"],
  ] as const)
    await prisma.reaction.create({ data: { postId, userId, type } });

  const categoryData = [
    ["housing", "Housing", "🏠"],
    ["furniture", "Furniture", "🪑"],
    ["bicycle", "Bicycle", "🚲"],
    ["laptop", "Laptop", "💻"],
    ["phone", "Phone", "📱"],
    ["books", "Books", "📚"],
    ["electronics", "Electronics", "🎧"],
    ["miscellaneous", "Miscellaneous", "📦"],
  ];
  const categories = await Promise.all(
    categoryData.map(([slug, name, icon], order) =>
      prisma.marketplaceCategory.create({ data: { slug, name, icon, order } }),
    ),
  );
  const category = Object.fromEntries(
    categories.map((item) => [item.slug, item]),
  );
  const listingData = [
    {
      slug: "giant-escape-city-bike",
      sellerId: kwame.id,
      categoryId: category.bicycle.id,
      cityId: beijing.id,
      title: "Giant Escape city bicycle",
      description:
        "Well-maintained, recently serviced, and perfect for campus. Includes lock and front light. Pickup near Wudaokou.",
      priceFen: 68000,
      isNegotiable: true,
      color: "#3f6d5c",
    },
    {
      slug: "ikea-study-desk",
      sellerId: wambui.id,
      categoryId: category.furniture.id,
      cityId: hangzhou.id,
      title: "IKEA study desk",
      description:
        "Clean white desk with two drawers. Selling because I am graduating. Collection only.",
      priceFen: 24000,
      isNegotiable: false,
      color: "#c9a570",
    },
    {
      slug: "macbook-air-m1",
      sellerId: chidi.id,
      categoryId: category.laptop.id,
      cityId: shanghai.id,
      title: "MacBook Air M1 · 256GB",
      description:
        "Battery health 91%, includes original charger and protective sleeve. Can meet on campus to test.",
      priceFen: 360000,
      isNegotiable: true,
      color: "#8c8c94",
    },
    {
      slug: "hsk-4-book-set",
      sellerId: ama.id,
      categoryId: category.books.id,
      cityId: beijing.id,
      title: "HSK 4 complete book set",
      description:
        "Textbook, workbook, and vocabulary cards. Light notes in pencil; otherwise excellent condition.",
      priceFen: 7500,
      isNegotiable: false,
      color: "#4a6fa5",
    },
  ];
  const listings = [];
  for (const item of listingData) {
    const { color, ...data } = item;
    const listing = await prisma.marketplaceListing.create({
      data: {
        ...data,
        status: "ACTIVE",
        publishedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
      },
    });
    const media = await createDemoListingImage({
      ownerId: item.sellerId,
      attachmentId: listing.id,
      title: item.title,
      color,
    });
    await prisma.listingImage.create({
      data: {
        listingId: listing.id,
        mediaId: media.id,
        altText: item.title,
        width: media.width,
        height: media.height,
        order: 0,
      },
    });
    listings.push(listing);
  }
  await prisma.listingFavorite.create({
    data: { listingId: listings[0].id, userId: ama.id },
  });

  const guides = [];
  guides.push(
    await prisma.guide.create({
      data: {
        slug: "first-72-hours-in-china",
        title: "Your first 72 hours in China",
        summary:
          "The essential sequence for registration, connectivity, payments, and getting your bearings after landing.",
        category: "ARRIVAL",
        estimatedMinutes: 14,
        published: true,
        featured: true,
        createdById: admin.id,
        publishedAt: new Date(),
        steps: {
          create: [
            {
              order: 1,
              title: "Confirm your university registration time",
              content:
                "Check the exact building, opening hours, and documents your international student office expects. Save a local copy of your admission letter and JW form.",
            },
            {
              order: 2,
              title: "Complete temporary residence registration",
              content:
                "Hotels usually handle this automatically. If you stay in a private apartment or dorm that does not register you, visit the local police station with your passport and housing details within the required local window.",
            },
            {
              order: 3,
              title: "Activate a Chinese SIM",
              content:
                "Bring your passport to an official China Mobile, China Unicom, or China Telecom shop. Ask your university which network works best on campus.",
            },
            {
              order: 4,
              title: "Connect Alipay and WeChat",
              content:
                "Install both apps, add your international card where supported, and complete identity verification. Keep some cash or a working international card as backup.",
            },
            {
              order: 5,
              title: "Save your essential contacts",
              content:
                "International student office, dorm manager, class coordinator, nearest hospital, local emergency numbers, and one trusted student contact.",
            },
          ],
        },
      },
    }),
  );
  guides.push(
    await prisma.guide.create({
      data: {
        slug: "residence-permit-without-the-panic",
        title: "Residence permit, without the panic",
        summary:
          "A calm checklist for the medical exam, university documents, police registration, and appointment day.",
        category: "RESIDENCY",
        estimatedMinutes: 18,
        published: true,
        featured: true,
        createdById: moderator.id,
        publishedAt: new Date(),
        steps: {
          create: [
            {
              order: 1,
              title: "Check your visa validity",
              content:
                "Note the exact expiry date and start early. Your university may organize appointments in batches.",
            },
            {
              order: 2,
              title: "Prepare the document folder",
              content:
                "Passport, visa page, admission documents, accommodation registration, photos, and university-issued forms.",
            },
            {
              order: 3,
              title: "Complete the required health check",
              content:
                "Use the center recommended by your university and keep every receipt and result sheet.",
            },
          ],
        },
      },
    }),
  );
  guides.push(
    await prisma.guide.create({
      data: {
        slug: "open-a-chinese-bank-account",
        title: "Open a Chinese bank account",
        summary:
          "What to bring, what to ask, and how to connect your new account to everyday payment apps.",
        category: "MONEY",
        estimatedMinutes: 12,
        published: true,
        createdById: admin.id,
        publishedAt: new Date(),
        steps: {
          create: [
            {
              order: 1,
              title: "Ask which branch accepts students",
              content:
                "Requirements vary by branch. Your university international office usually knows the most student-friendly location.",
            },
            {
              order: 2,
              title: "Bring your identity and student documents",
              content:
                "Passport, valid visa or residence permit, student ID, Chinese phone number, and proof of address if requested.",
            },
            {
              order: 3,
              title: "Secure the account",
              content:
                "Set a unique PIN, enable transaction alerts, and never share verification codes.",
            },
          ],
        },
      },
    }),
  );
  guides.push(
    await prisma.guide.create({
      data: {
        slug: "healthcare-when-you-need-it",
        title: "Healthcare when you need it",
        summary:
          "Know where to go, how hospital registration works, and what your student insurance may cover.",
        category: "HEALTH",
        estimatedMinutes: 10,
        published: true,
        createdById: moderator.id,
        publishedAt: new Date(),
        steps: {
          create: [
            {
              order: 1,
              title: "Save your insurance details",
              content:
                "Keep the policy number, hotline, and claim instructions available offline.",
            },
            {
              order: 2,
              title: "Find your nearest suitable hospital",
              content:
                "Ask your university for hospitals with international or English-language desks.",
            },
          ],
        },
      },
    }),
  );
  const firstGuideSteps = await prisma.guideStep.findMany({
    where: { guideId: guides[0].id },
    orderBy: { order: "asc" },
    take: 3,
  });
  for (const step of firstGuideSteps)
    await prisma.guideProgress.create({
      data: { userId: ama.id, stepId: step.id },
    });

  const permitQuestion = await prisma.question.create({
    data: {
      slug: "renewing-residence-permit-during-summer",
      authorId: ama.id,
      category: "VISA",
      title: "Can I renew my residence permit during the summer break?",
      body: "My permit expires in late August, but the university office has reduced summer hours. Has anyone handled this recently in Beijing?",
    },
  });
  const permitAnswer = await prisma.answer.create({
    data: {
      questionId: permitQuestion.id,
      authorId: moderator.id,
      body: "Yes, but start early. Ask the international office for the stamped enrollment letter before their reduced schedule begins, then confirm the appointment process with the Exit-Entry bureau. Mine required the university letter, accommodation registration, passport, photo receipt, and current permit.",
    },
  });
  await prisma.question.update({
    where: { id: permitQuestion.id },
    data: { bestAnswerId: permitAnswer.id },
  });
  await prisma.answerVote.create({
    data: { answerId: permitAnswer.id, userId: kwame.id },
  });
  await prisma.answerVote.create({
    data: { answerId: permitAnswer.id, userId: wambui.id },
  });
  const bankQuestion = await prisma.question.create({
    data: {
      slug: "bank-branch-for-international-students",
      authorId: chidi.id,
      category: "BANK",
      title: "Which bank branch is easiest for international students?",
      body: "I tried one branch near campus and they asked for documents the university did not mention. Looking for a recent Shanghai experience.",
    },
  });
  await prisma.answer.create({
    data: {
      questionId: bankQuestion.id,
      authorId: kwame.id,
      body: "Branch rules vary more than bank brands. Ask your international office for the exact branch they use, call before going, and bring passport, student ID, Chinese phone number, residence registration, and tax ID if you have one.",
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        recipientId: ama.id,
        actorId: chidi.id,
        type: "REPLY",
        title: "Chidi replied to your comment",
        body: "Thank you! Did they accept a digital admission letter?",
        href: `/communities/${tsinghuaCommunity.slug}?post=${metroPost.id}`,
      },
      {
        recipientId: ama.id,
        actorId: moderator.id,
        type: "COMMUNITY_ANNOUNCEMENT",
        title: "New arrivals Q&A this Wednesday",
        body: "Bring your visa, banking, housing, and campus questions.",
        href: `/communities/${newcomerCommunity.slug}`,
      },
      {
        recipientId: ama.id,
        actorId: kwame.id,
        type: "MARKETPLACE_UPDATE",
        title: "A bicycle you saved is still available",
        body: "Giant Escape city bicycle · ¥680",
        href: `/marketplace/${listings[0].slug}`,
        readAt: new Date(),
      },
    ],
  });

  const firstMessageAt = new Date(Date.now() - 75 * 60_000);
  const replyMessageAt = new Date(Date.now() - 18 * 60_000);
  const demoConversation = await prisma.conversation.create({
    data: {
      directKey: [ama.id, kwame.id].sort().join(":"),
      lastMessageAt: replyMessageAt,
      participants: {
        create: [
          { userId: ama.id, lastReadAt: firstMessageAt },
          { userId: kwame.id, lastReadAt: replyMessageAt },
        ],
      },
      messages: {
        create: [
          {
            senderId: ama.id,
            body: "Hi Kwame! Is the student metro card office still open before 4 PM?",
            createdAt: firstMessageAt,
          },
          {
            senderId: kwame.id,
            body: "Yes 😊 I went today. Bring your passport, admission letter, and one photo.",
            createdAt: replyMessageAt,
          },
        ],
      },
    },
  });
  await prisma.notification.create({
    data: {
      recipientId: ama.id,
      actorId: kwame.id,
      type: "MESSAGE",
      title: "New message",
      body: "Yes 😊 I went today. Bring your passport, admission letter, and one photo.",
      href: `/messages/${demoConversation.id}`,
    },
  });

  const seededReport = await prisma.report.create({
    data: {
      reporterId: ama.id,
      assigneeId: moderator.id,
      assignedById: admin.id,
      assignedAt: new Date(),
      targetType: "MarketplaceListing",
      targetId: listings[2].id,
      reason: "SCAM",
      details:
        "Seller profile looks legitimate, but the requested off-platform deposit should be reviewed.",
      status: "REVIEWING",
    },
  });
  await prisma.reportNote.create({
    data: {
      reportId: seededReport.id,
      authorId: moderator.id,
      body: "Reviewing the off-platform payment request and preserving the member-provided context.",
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "SEED_COMPLETED",
      entityType: "System",
      entityId: "kondo-mvp",
      newValue: {
        users: users.length,
        communities: communities.length,
        guides: guides.length,
        conversations: 1,
      },
    },
  });

  const analyticsNames = [
    "SESSION_STARTED",
    "COMMUNITY_VIEWED",
    "POST_REACTED",
    "LISTING_VIEWED",
    "GUIDE_STEP_COMPLETED",
    "SEARCH_PERFORMED",
  ] as const;
  for (const [index, name] of analyticsNames.entries()) {
    for (let count = 0; count < (index + 1) * 3; count += 1)
      await prisma.analyticsEvent.create({
        data: {
          userId: users[count % users.length].id,
          name,
          sessionId: `demo-${index}-${count}`,
          createdAt: new Date(Date.now() - (count % 6) * 86_400_000),
        },
      });
  }

  console.log(
    `Seeded Kondo with ${users.length} users, ${communities.length} communities, ${listings.length} listings, ${guides.length} guides, and 1 conversation.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
