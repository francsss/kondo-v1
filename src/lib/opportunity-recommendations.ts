import type { Prisma } from "@prisma/client";
import {
  opportunityCardSelect,
  serializeOpportunityCard,
} from "@/lib/opportunities";
import { publicOpportunityWhere } from "@/lib/opportunity-visibility";
import { opportunityTypesForCategory } from "@/lib/opportunity-types";
import { prisma } from "@/lib/prisma";

/**
 * Student Hub opportunity rails.
 *
 * Recommendations are transparent and bounded. Every rail is driven by a
 * declared factor (journey, degree level, field, city, university) and carries
 * the explanation the UI shows, so no unexplained score is ever displayed.
 *
 * Inputs are limited to profile and onboarding fields the user supplied. Private
 * message content is never read, and no protected or inferred attribute
 * participates.
 */

const RAIL_LIMIT = 6;

export type OpportunityRail = {
  key: string;
  title: string;
  /** Shown verbatim; describes exactly why these items were chosen. */
  explanation: string;
  href: string;
  items: ReturnType<typeof serializeOpportunityCard>[];
};

type Viewer = {
  userId: string;
  journey: string | null;
  studyLevel: string | null;
  universityId: string | null;
  cityId: string | null;
  degree: string | null;
  targetCityIds: readonly string[];
};

async function loadViewer(userId: string): Promise<Viewer | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      studentJourney: true,
      studyLevel: true,
      universityId: true,
      cityId: true,
      degree: true,
      targetCities: { select: { cityId: true } },
    },
  });
  if (!user) return null;
  return {
    userId: user.id,
    journey: user.studentJourney,
    studyLevel: user.studyLevel,
    universityId: user.universityId,
    cityId: user.cityId,
    degree: user.degree,
    targetCityIds: user.targetCities.map(({ cityId }) => cityId),
  };
}

async function rail(input: {
  key: string;
  title: string;
  explanation: string;
  href: string;
  where: Prisma.OpportunityWhereInput;
  now: Date;
}): Promise<OpportunityRail | null> {
  const rows = await prisma.opportunity.findMany({
    where: { ...publicOpportunityWhere({ now: input.now }), ...input.where },
    select: opportunityCardSelect,
    orderBy: [
      { applicationDeadline: { sort: "asc", nulls: "last" } },
      { publishedAt: "desc" },
      { id: "asc" },
    ],
    take: RAIL_LIMIT,
  });
  // Only rails with real content are returned; the Student Hub never renders an
  // empty or placeholder recommendation section.
  if (rows.length === 0) return null;
  return {
    key: input.key,
    title: input.title,
    explanation: input.explanation,
    href: input.href,
    items: rows.map((row) => serializeOpportunityCard(row, input.now)),
  };
}

export async function getStudentHubOpportunityRails(
  userId: string,
  now = new Date(),
): Promise<OpportunityRail[]> {
  const viewer = await loadViewer(userId);
  if (!viewer) return [];

  const scholarshipTypes = opportunityTypesForCategory("scholarships");
  const internshipTypes = opportunityTypesForCategory("internships");
  const jobTypes = opportunityTypesForCategory("jobs");
  const researchTypes = opportunityTypesForCategory("research");

  const prospective =
    viewer.journey === "PROSPECTIVE_STUDENT" ||
    viewer.journey === "ADMITTED_STUDENT";
  const professional =
    viewer.journey === "ALUMNI" || viewer.journey === "PROFESSIONAL";

  const candidates: (Promise<OpportunityRail | null> | null)[] = [];

  // Prospective students may have no university at all; scholarship discovery
  // is driven by intended degree and target cities instead.
  if (prospective || !professional) {
    candidates.push(
      rail({
        key: "scholarships",
        title: prospective
          ? "Scholarships for your intended degree"
          : "Recommended scholarships",
        explanation: viewer.studyLevel
          ? `Recommended because it accepts ${viewer.studyLevel.toLowerCase().replace(/_/g, " ")} students.`
          : "Recommended because it is open to international students in China.",
        href: "/opportunities/scholarships",
        where: {
          type: { in: [...scholarshipTypes] },
          ...(viewer.studyLevel
            ? {
                OR: [
                  { degreeLevels: { none: {} } },
                  {
                    degreeLevels: {
                      some: { degreeLevel: viewer.studyLevel as never },
                    },
                  },
                ],
              }
            : {}),
        },
        now,
      }),
    );
  }

  if (!prospective) {
    candidates.push(
      rail({
        key: "internships",
        title: professional
          ? "Graduate internships and fellowships"
          : "Internships for your field",
        explanation: viewer.degree
          ? `Recommended because your field of study is ${viewer.degree}.`
          : "Recommended because it is open to students in China.",
        href: "/opportunities/internships",
        where: { type: { in: [...internshipTypes] } },
        now,
      }),
    );
  }

  if (viewer.cityId) {
    candidates.push(
      rail({
        key: "jobs-near-you",
        title: "Jobs near your city",
        explanation: "Recommended because it is in the city on your profile.",
        href: "/opportunities/jobs",
        where: { type: { in: [...jobTypes] }, cityId: viewer.cityId },
        now,
      }),
    );
  }

  if (viewer.universityId) {
    candidates.push(
      rail({
        key: "from-your-university",
        title: "From your university",
        explanation:
          "Recommended because it is published for the university on your profile.",
        href: "/opportunities",
        where: { universityId: viewer.universityId },
        now,
      }),
    );
  }

  candidates.push(
    rail({
      key: "research",
      title: "Research opportunities",
      explanation: "Open research placements and assistantships.",
      href: "/opportunities",
      where: { type: { in: [...researchTypes] } },
      now,
    }),
  );

  const resolved = await Promise.all(
    candidates.filter((entry) => entry !== null),
  );
  return resolved.filter((entry): entry is OpportunityRail => entry !== null);
}

/** Saved deadlines and applications needing action, for the Student Hub. */
export async function getStudentHubOpportunityActions(
  userId: string,
  now = new Date(),
) {
  const [savedWithDeadlines, actionRequired] = await Promise.all([
    prisma.opportunitySaved.findMany({
      where: {
        userId,
        opportunity: {
          ...publicOpportunityWhere({ now }),
          applicationDeadline: { gt: now },
        },
      },
      select: {
        opportunity: {
          select: {
            id: true,
            slug: true,
            title: true,
            applicationDeadline: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.opportunityApplication.findMany({
      where: {
        applicantUserId: userId,
        status: { in: ["MORE_INFORMATION_REQUIRED", "INTERVIEW", "OFFERED"] },
      },
      select: {
        id: true,
        status: true,
        opportunity: { select: { title: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    savedDeadlines: savedWithDeadlines.map((row) => ({
      id: row.opportunity.id,
      title: row.opportunity.title,
      href: `/opportunities/${row.opportunity.slug}`,
      deadline: row.opportunity.applicationDeadline?.toISOString() ?? null,
    })),
    actionRequired: actionRequired.map((row) => ({
      id: row.id,
      title: row.opportunity.title,
      status: row.status,
      href: `/opportunities/applications/${row.id}`,
    })),
  };
}
