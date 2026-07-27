import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SmartJob = Prisma.NotificationJobCreateManyInput;

const DAY_MS = 86_400_000;
const INTENTION_LABELS: Record<string, string> = {
  FRIENDS: "friendship",
  STUDY: "study partner",
  LANGUAGE: "language exchange",
  SPORTS: "sports",
  CITY: "city discovery",
  NETWORKING: "networking",
  COUNTRY: "student community",
};

function dayBucket(now: Date) {
  return now.toISOString().slice(0, 10);
}

function weekBucket(now: Date) {
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return dayBucket(date);
}

function compatibleGender(
  preference: "ALL" | "MALE" | "FEMALE",
  gender: "MALE" | "FEMALE" | null,
) {
  return preference === "ALL" || preference === gender;
}

function localClock(now: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    const dayNumber =
      (
        {
          Mon: 1,
          Tue: 2,
          Wed: 3,
          Thu: 4,
          Fri: 5,
          Sat: 6,
          Sun: 7,
        } as const
      )[values.weekday as "Mon"] ?? 1;
    return {
      dayNumber,
      date: `${values.year}-${values.month}-${values.day}`,
      minutes: Number(values.hour) * 60 + Number(values.minute),
    };
  } catch {
    const day = now.getUTCDay();
    return {
      dayNumber: day === 0 ? 7 : day,
      date: dayBucket(now),
      minutes: now.getUTCHours() * 60 + now.getUTCMinutes(),
    };
  }
}

function timeMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

async function insertJobs(jobs: SmartJob[]) {
  let created = 0;
  for (let offset = 0; offset < jobs.length; offset += 500) {
    const result = await prisma.notificationJob.createMany({
      data: jobs.slice(offset, offset + 500),
      skipDuplicates: true,
    });
    created += result.count;
  }
  return created;
}

async function academicReminderJobs(now: Date, recipientIds?: string[]) {
  const courses = await prisma.scheduleCourse.findMany({
    where: {
      schedule: {
        isActive: true,
        confirmedAt: { not: null },
        owner: {
          status: "ACTIVE",
          ...(recipientIds?.length ? { id: { in: recipientIds } } : {}),
        },
      },
    },
    select: {
      id: true,
      courseName: true,
      dayOfWeek: true,
      specificDate: true,
      startTime: true,
      room: true,
      building: true,
      schedule: {
        select: {
          id: true,
          ownerId: true,
          timezone: true,
          academicTerm: {
            select: { startsOn: true, endsOn: true, isActive: true },
          },
        },
      },
    },
    take: 2_000,
  });
  const jobs: SmartJob[] = [];
  for (const course of courses) {
    const clock = localClock(now, course.schedule.timezone);
    const term = course.schedule.academicTerm;
    if (
      term &&
      (!term.isActive ||
        clock.date < term.startsOn.toISOString().slice(0, 10) ||
        clock.date > term.endsOn.toISOString().slice(0, 10))
    ) {
      continue;
    }
    const specificDate = course.specificDate?.toISOString().slice(0, 10);
    if (
      (specificDate && specificDate !== clock.date) ||
      (!specificDate && course.dayOfWeek !== clock.dayNumber)
    ) {
      continue;
    }
    const minutes = timeMinutes(course.startTime) - clock.minutes;
    if (minutes < 10 || minutes > 20) continue;
    const location = [course.building, course.room].filter(Boolean).join(" · ");
    jobs.push({
      recipientId: course.schedule.ownerId,
      type: "ACADEMIC",
      templateKey: "ACADEMIC_CLASS_REMINDER",
      data: {
        courseName: course.courseName,
        minutes,
        location: location || "Open your timetable for class details.",
      },
      href: `/student-hub/tools/timetables/${course.schedule.id}`,
      dedupeKey: `academic-class:${course.id}:${clock.date}`,
    });
  }
  return jobs;
}

async function onboardingJobs(now: Date, recipientIds?: string[]) {
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      ...(recipientIds?.length ? { id: { in: recipientIds } } : {}),
      onboardingCompletedAt: null,
      createdAt: { lte: new Date(now.getTime() - DAY_MS) },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return users.map(({ id }): SmartJob => ({
    recipientId: id,
    type: "ACCOUNT",
    templateKey: "ONBOARDING_REMINDER",
    data: {},
    href: "/onboarding",
    dedupeKey: `onboarding-reminder:${id}`,
  }));
}

async function communitySummaryJobs(now: Date, recipientIds?: string[]) {
  const since = new Date(now.getTime() - DAY_MS);
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED", createdAt: { gte: since } },
    select: {
      id: true,
      authorId: true,
      communityId: true,
      community: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 1_000,
  });
  const communityIds = [
    ...new Set(posts.map(({ communityId }) => communityId)),
  ];
  if (!communityIds.length) return [];
  const memberships = await prisma.communityMember.findMany({
    where: {
      communityId: { in: communityIds },
      ...(recipientIds?.length ? { userId: { in: recipientIds } } : {}),
      user: { status: "ACTIVE" },
    },
    select: { userId: true, communityId: true },
    take: 10_000,
  });
  const summaries = new Map<
    string,
    { count: number; communityName: string; slug: string }
  >();
  for (const membership of memberships) {
    const relevant = posts.filter(
      (post) =>
        post.communityId === membership.communityId &&
        post.authorId !== membership.userId,
    );
    if (!relevant.length) continue;
    const current = summaries.get(membership.userId);
    if (!current || relevant.length > current.count) {
      summaries.set(membership.userId, {
        count: relevant.length,
        communityName: relevant[0]!.community.name,
        slug: relevant[0]!.community.slug,
      });
    }
  }
  const bucket = dayBucket(now);
  return [...summaries].map(([recipientId, summary]): SmartJob => ({
    recipientId,
    type: "COMMUNITY_ACTIVITY",
    templateKey: "COMMUNITY_DAILY_SUMMARY",
    data: {
      communityName: summary.communityName,
      count: summary.count,
    },
    href: `/communities/${summary.slug}`,
    dedupeKey: `community-summary:${recipientId}:${bucket}`,
  }));
}

async function communityMemberJobs(now: Date, recipientIds?: string[]) {
  const joined = await prisma.communityMember.findMany({
    where: {
      joinedAt: { gte: new Date(now.getTime() - DAY_MS) },
      role: "MEMBER",
      user: { status: "ACTIVE" },
    },
    select: {
      communityId: true,
      community: { select: { name: true, slug: true } },
    },
    take: 2_000,
  });
  const counts = new Map<
    string,
    { count: number; name: string; slug: string }
  >();
  for (const membership of joined) {
    const current = counts.get(membership.communityId);
    counts.set(membership.communityId, {
      count: (current?.count ?? 0) + 1,
      name: membership.community.name,
      slug: membership.community.slug,
    });
  }
  const active = [...counts].filter(([, summary]) => summary.count >= 2);
  if (!active.length) return [];
  const staff = await prisma.communityMember.findMany({
    where: {
      communityId: { in: active.map(([communityId]) => communityId) },
      role: { in: ["OWNER", "MODERATOR"] },
      ...(recipientIds?.length ? { userId: { in: recipientIds } } : {}),
      user: { status: "ACTIVE" },
    },
    select: { userId: true, communityId: true },
  });
  const bucket = dayBucket(now);
  return staff.flatMap((membership): SmartJob[] => {
    const summary = counts.get(membership.communityId);
    if (!summary) return [];
    return [
      {
        recipientId: membership.userId,
        type: "COMMUNITY_ACTIVITY",
        templateKey: "COMMUNITY_MEMBER_SUMMARY",
        data: { communityName: summary.name, count: summary.count },
        href: `/communities/${summary.slug}/manage`,
        dedupeKey: `community-members:${membership.communityId}:${membership.userId}:${bucket}`,
      },
    ];
  });
}

async function meetMatchJobs(now: Date, recipientIds?: string[]) {
  const profiles = await prisma.meetDiscoveryProfile.findMany({
    where: {
      completedAt: { not: null },
      nearbyVisibility: true,
      discoveryCityId: { not: null },
      user: {
        status: "ACTIVE",
        onboardingCompletedAt: { not: null },
        profileAudience: { in: ["PUBLIC", "MEMBERS"] },
      },
    },
    select: {
      userId: true,
      interestedIn: true,
      lookingFor: true,
      discoveryCityId: true,
      discoveryCity: { select: { name: true } },
      user: { select: { gender: true } },
    },
    take: 500,
  });
  const bucket = dayBucket(now);
  const jobs: SmartJob[] = [];
  for (const profile of profiles) {
    if (recipientIds?.length && !recipientIds.includes(profile.userId))
      continue;
    const intentions = profile.lookingFor.filter(
      (intent) => intent !== "RELATIONSHIP",
    );
    const intention = intentions[0];
    if (!intention) continue;
    const count = profiles.filter(
      (candidate) =>
        candidate.userId !== profile.userId &&
        candidate.discoveryCityId === profile.discoveryCityId &&
        compatibleGender(profile.interestedIn, candidate.user.gender) &&
        compatibleGender(candidate.interestedIn, profile.user.gender) &&
        candidate.lookingFor.some((value) => intentions.includes(value)),
    ).length;
    if (!count) continue;
    jobs.push({
      recipientId: profile.userId,
      type: "MEET_ACTIVITY",
      templateKey: "MEET_MATCHES",
      data: {
        areaName: profile.discoveryCity?.name ?? "your study city",
        count,
        intention: INTENTION_LABELS[intention] ?? "student connection",
      },
      href: "/communities?tab=meet",
      dedupeKey: `meet-matches:${profile.userId}:${bucket}`,
    });
  }
  return jobs;
}

async function recommendationJobs(now: Date, recipientIds?: string[]) {
  const [users, listings, scholarships] = await Promise.all([
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        onboardingCompletedAt: { not: null },
        ...(recipientIds?.length ? { id: { in: recipientIds } } : {}),
      },
      select: {
        id: true,
        cityId: true,
        universityId: true,
        studyLevel: true,
        country: { select: { code: true } },
      },
      orderBy: { lastActiveAt: "desc" },
      take: 500,
    }),
    prisma.marketplaceListing.findMany({
      where: {
        status: "ACTIVE",
        publishedAt: { gte: new Date(now.getTime() - DAY_MS) },
      },
      select: {
        sellerId: true,
        cityId: true,
        title: true,
        slug: true,
        city: { select: { name: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: 500,
    }),
    prisma.scholarship.findMany({
      where: {
        isActive: true,
        status: { in: ["OPEN", "OPENING_SOON"] },
        OR: [{ closesAt: null }, { closesAt: { gte: now } }],
      },
      select: {
        id: true,
        slug: true,
        title: true,
        universityId: true,
        studyLevels: true,
        eligibleNationalities: true,
        universities: { select: { universityId: true } },
      },
      orderBy: [{ isFeatured: "desc" }, { closesAt: "asc" }],
      take: 200,
    }),
  ]);
  const day = dayBucket(now);
  const week = weekBucket(now);
  const jobs: SmartJob[] = [];
  for (const user of users) {
    const listing = listings.find(
      (item) => item.cityId === user.cityId && item.sellerId !== user.id,
    );
    if (listing) {
      jobs.push({
        recipientId: user.id,
        type: "RECOMMENDATION",
        templateKey: "MARKETPLACE_NEARBY",
        data: {
          listingTitle: listing.title,
          cityName: listing.city.name,
        },
        href: `/marketplace/${listing.slug}`,
        dedupeKey: `marketplace-nearby:${user.id}:${day}`,
      });
    }
    const scholarship = scholarships.find((item) => {
      const universityMatch =
        !item.universityId ||
        item.universityId === user.universityId ||
        item.universities.some(
          ({ universityId }) => universityId === user.universityId,
        );
      const levelMatch =
        !item.studyLevels.length ||
        Boolean(user.studyLevel && item.studyLevels.includes(user.studyLevel));
      const nationalityMatch =
        !item.eligibleNationalities.length ||
        Boolean(
          user.country?.code &&
          item.eligibleNationalities.includes(user.country.code),
        );
      return universityMatch && levelMatch && nationalityMatch;
    });
    if (scholarship) {
      jobs.push({
        recipientId: user.id,
        type: "RECOMMENDATION",
        templateKey: "SCHOLARSHIP_MATCH",
        data: { scholarshipTitle: scholarship.title },
        href: `/student-hub/scholarships/${scholarship.slug}`,
        dedupeKey: `scholarship-match:${user.id}:${week}`,
      });
    }
  }
  return jobs;
}

export async function generateSmartNotificationJobs(
  now = new Date(),
  options: { includeHourly?: boolean; recipientIds?: string[] } = {},
) {
  const includeHourly =
    options.includeHourly ??
    (now.getUTCMinutes() >= 0 && now.getUTCMinutes() < 5);
  const academic = await academicReminderJobs(now, options.recipientIds);
  const periodic = includeHourly
    ? await Promise.all([
        onboardingJobs(now, options.recipientIds),
        communitySummaryJobs(now, options.recipientIds),
        communityMemberJobs(now, options.recipientIds),
        meetMatchJobs(now, options.recipientIds),
        recommendationJobs(now, options.recipientIds),
      ])
    : [];
  const jobs = [...academic, ...periodic.flat()];
  return {
    generated: jobs.length,
    created: await insertJobs(jobs),
    academic: academic.length,
    periodic: periodic.flat().length,
  };
}
