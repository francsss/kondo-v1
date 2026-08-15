import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Nearby: the students around you who are worth knowing.
 *
 * Two facts about this codebase shape everything below.
 *
 * First, Kondo stores no coordinates for people. `User` carries a city, a
 * university and a country; the latitude/longitude columns in the schema
 * belong to `HousingListing`. The map this feature replaced produced its
 * "Around 500 m" labels by hashing a profile ID into a scattered point near a
 * campus and measuring the distance to that invention. Nothing here reports a
 * distance in metres or kilometres, because there is no honest one to report.
 * Proximity is expressed with the real relationships that do exist: the same
 * campus, or the same city.
 *
 * Second, discovery used to run through `MeetDiscoveryProfile`, which matches
 * on gender preference and an age range. Nearby is student discovery, not
 * dating, so none of that is consulted and neither age nor gender is selected
 * from the database, let alone returned.
 */

/** The ranked pool a viewer is drawn from before paging. Bounded on purpose. */
const CANDIDATE_POOL_LIMIT = 240;
export const NEARBY_PAGE_SIZE = 12;

/**
 * How much a signal is worth. Plain numbers, so the order is explainable.
 *
 * The one deliberate crossover: a single shared community (20) sits just below
 * a shared field of study (24), while two or more (40+) sit above it. Being in
 * one community together can be incidental; being in several is not, and it
 * beats sharing a subject with a few thousand people in the same city.
 */
const SCORE = {
  sameUniversity: 100,
  sameField: 24,
  sharedCommunity: 20,
  maxSharedCommunities: 3,
  sameCity: 8,
} as const;

export type NearbyFilter = "ALL" | "UNIVERSITY" | "CITY";

/** What a row needs, and nothing else. No age, no gender, no coordinates. */
export type NearbyStudent = {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string;
  avatarMediaId: string | null;
  /** "Computer Science · Jiaxing University", already assembled and trimmed. */
  headline: string | null;
  /** "Same campus" | "Same city" | null when location is private. */
  proximity: string | null;
  /** One reason, never a list. */
  reason: string | null;
};

export type NearbyResult = {
  students: NearbyStudent[];
  nextCursor: string | null;
};

function normalizeField(value: string | null) {
  return value?.trim().toLowerCase() ?? null;
}

/**
 * The single relevance reason shown on a row.
 *
 * Ordered by how much it tells you that the proximity line does not. When the
 * proximity already says "Same campus", repeating "Same university" underneath
 * it is noise, so that pairing is skipped and the next reason is used.
 */
function relevanceReason(input: {
  sameUniversity: boolean;
  sharedCommunities: number;
  sameField: boolean;
  sameCity: boolean;
  proximity: string | null;
}) {
  if (input.sameUniversity && input.proximity !== "Same campus") {
    return "Same university";
  }
  if (input.sharedCommunities === 1) return "1 community in common";
  if (input.sharedCommunities > 1) {
    return `${input.sharedCommunities} communities in common`;
  }
  if (input.sameField) return "Same field of study";
  if (input.sameCity && input.proximity !== "Same city") return "Same city";
  return null;
}

export async function getNearbyStudents(input: {
  viewer: {
    id: string;
    cityId: string | null;
    universityId: string | null;
    degree: string | null;
  };
  filter: NearbyFilter;
  cursor?: string | null;
}): Promise<NearbyResult> {
  const { viewer } = input;
  // Without a study city there is no meaningful "near", and guessing one would
  // be worse than saying so. The caller renders a prompt for this case.
  if (!viewer.cityId && !viewer.universityId) {
    return { students: [], nextCursor: null };
  }

  const viewerCommunityIds = (
    await prisma.communityMember.findMany({
      where: { userId: viewer.id },
      select: { communityId: true },
    })
  ).map((membership) => membership.communityId);

  /*
   * Scope. "Near" means the same city, which is the smallest real unit Kondo
   * knows about. The university filter narrows that further; it never widens
   * to another city.
   */
  const locationScope: Prisma.UserWhereInput =
    input.filter === "UNIVERSITY"
      ? { universityId: viewer.universityId ?? "__none__" }
      : input.filter === "CITY"
        ? { cityId: viewer.cityId ?? "__none__" }
        : viewer.cityId
          ? { cityId: viewer.cityId }
          : { universityId: viewer.universityId };

  const candidates = await prisma.user.findMany({
    where: {
      // §21: the viewer is never a result in their own list.
      id: { not: viewer.id },
      status: "ACTIVE",
      onboardingCompletedAt: { not: null },
      // Private profiles are not discoverable at all.
      profileAudience: { in: ["PUBLIC", "MEMBERS"] },
      // The existing opt-out, reused rather than reinvented.
      nearbyDiscoveryEnabled: true,
      ...locationScope,
      blockedUsers: { none: { blockedId: viewer.id } },
      blockedByUsers: { none: { blockerId: viewer.id } },
    },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      avatarMediaId: true,
      degree: true,
      cityId: true,
      universityId: true,
      lastActiveAt: true,
      locationAudience: true,
      educationAudience: true,
      university: { select: { name: true, shortName: true } },
      // Bounded by the viewer's own memberships, so this cannot fan out.
      communityMemberships: viewerCommunityIds.length
        ? {
            where: { communityId: { in: viewerCommunityIds } },
            select: { communityId: true },
          }
        : false,
    },
    orderBy: [{ lastActiveAt: "desc" }, { id: "asc" }],
    take: CANDIDATE_POOL_LIMIT,
  });

  const viewerField = normalizeField(viewer.degree);

  const ranked = candidates
    .map((candidate) => {
      const sameUniversity = Boolean(
        viewer.universityId && candidate.universityId === viewer.universityId,
      );
      const sameCity = Boolean(
        viewer.cityId && candidate.cityId === viewer.cityId,
      );
      const sharedCommunities = candidate.communityMemberships?.length ?? 0;
      const sameField = Boolean(
        viewerField && normalizeField(candidate.degree) === viewerField,
      );

      /*
       * Education and location each answer to their own audience setting, so a
       * student who has hidden where they study still appears — just without
       * the parts they chose not to share.
       */
      const showsEducation = candidate.educationAudience !== "PRIVATE";
      const showsLocation = candidate.locationAudience !== "PRIVATE";

      const university = showsEducation
        ? (candidate.university?.shortName ??
          candidate.university?.name ??
          null)
        : null;
      const field = showsEducation ? candidate.degree?.trim() || null : null;
      const headline = [field, university].filter(Boolean).join(" · ") || null;

      const proximity = !showsLocation
        ? null
        : sameUniversity
          ? "Same campus"
          : sameCity
            ? "Same city"
            : null;

      const score =
        (sameUniversity ? SCORE.sameUniversity : 0) +
        (sameField ? SCORE.sameField : 0) +
        Math.min(sharedCommunities, SCORE.maxSharedCommunities) *
          SCORE.sharedCommunity +
        (sameCity ? SCORE.sameCity : 0);

      return {
        score,
        lastActiveAt: candidate.lastActiveAt?.getTime() ?? 0,
        student: {
          id: candidate.id,
          username: candidate.username,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          avatarMediaId: candidate.avatarMediaId,
          headline,
          proximity,
          reason: relevanceReason({
            sameUniversity,
            sharedCommunities,
            sameField,
            sameCity,
            proximity,
          }),
        } satisfies NearbyStudent,
      };
    })
    // Deterministic to the last tiebreak: equal scores fall back to recency and
    // then to ID, so the same viewer sees the same order and paging cannot
    // repeat or skip anyone.
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.lastActiveAt - a.lastActiveAt ||
        a.student.id.localeCompare(b.student.id),
    );

  const start = input.cursor
    ? ranked.findIndex((entry) => entry.student.id === input.cursor) + 1
    : 0;
  // A cursor for someone who has since dropped out of the pool reads as 0 from
  // `findIndex`; treating that as "start again" would repeat the first page, so
  // it ends the list instead.
  if (input.cursor && start === 0) return { students: [], nextCursor: null };

  const page = ranked.slice(start, start + NEARBY_PAGE_SIZE);
  const hasMore = start + NEARBY_PAGE_SIZE < ranked.length;

  return {
    students: page.map((entry) => entry.student),
    nextCursor: hasMore ? (page.at(-1)?.student.id ?? null) : null,
  };
}
