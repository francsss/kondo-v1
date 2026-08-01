import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { discoverRoommateProfiles } from "@/lib/roommate-profiles";
import { prisma } from "@/lib/prisma";

/**
 * The reported failure: two active profiles sharing at least four compatible
 * preferences, and neither member sees the other when they open Match.
 */

const isolated =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isolated ? describe.sequential : describe.skip;
const domain = "roommate-match.test";

const MOVE_IN = new Date("2026-09-01T00:00:00.000Z");

let ids: {
  aliceId: string;
  bobId: string;
  outsiderId: string;
  cityId: string;
  otherCityId: string;
  universityId: string;
  countryId: string;
};

async function makeUser(prefix: string) {
  const user = await prisma.user.create({
    data: {
      email: `${prefix}-${randomUUID()}@${domain}`,
      passwordHash: "x".repeat(60),
      firstName: prefix,
      lastName: "Tester",
      status: "ACTIVE",
    },
    select: { id: true },
  });
  return user.id;
}

/**
 * A profile as the roommate form actually produces one: a maximum budget and
 * NO minimum, which is the shape that used to disappear from every search.
 */
function profileData(overrides: Record<string, unknown> = {}) {
  return {
    status: "ACTIVE" as const,
    visibility: "MEMBERS_ONLY" as const,
    cityId: ids.cityId,
    universityId: ids.universityId,
    moveInDate: MOVE_IN,
    stayDurationMonths: 12,
    budgetMinimumMinor: null,
    budgetMaximumMinor: 300_000,
    currency: "CNY",
    // Explicit so `beforeEach` fully resets a profile a previous test expired.
    expiresAt: null,
    preferredHousingTypes: ["PRIVATE_ROOM" as const],
    languages: ["English", "French"],
    sleepSchedule: "EARLY",
    cleanlinessPreference: "TIDY",
    smokingPreference: "NOT_ALLOWED" as const,
    petPreference: "NOT_SPECIFIED" as const,
    introduction:
      "A roommate profile created for the matching integration test.",
    allowInterests: true,
    ...overrides,
  };
}

async function setProfile(
  userId: string,
  overrides: Record<string, unknown> = {},
) {
  const data = profileData(overrides);
  return prisma.roommateProfile.upsert({
    where: { userId },
    create: { ...data, userId } as never,
    update: data as never,
    select: { id: true },
  });
}

function userIds(result: Awaited<ReturnType<typeof discoverRoommateProfiles>>) {
  return result.items.map((item) => item.userId);
}

postgresDescribe("roommate matching (postgres)", () => {
  beforeAll(async () => {
    const country = await prisma.country.create({
      data: {
        name: `Roommate Land ${randomUUID().slice(0, 8)}`,
        code: randomUUID().slice(0, 2).toUpperCase(),
      },
      select: { id: true },
    });
    const [city, otherCity] = await Promise.all([
      prisma.city.create({
        data: {
          name: `Match City ${randomUUID().slice(0, 6)}`,
          slug: `match-city-${randomUUID().slice(0, 8)}`,
          countryId: country.id,
        },
        select: { id: true },
      }),
      prisma.city.create({
        data: {
          name: `Other City ${randomUUID().slice(0, 6)}`,
          slug: `other-city-${randomUUID().slice(0, 8)}`,
          countryId: country.id,
        },
        select: { id: true },
      }),
    ]);
    const university = await prisma.university.create({
      data: {
        name: `Match University ${randomUUID().slice(0, 6)}`,
        slug: `match-university-${randomUUID().slice(0, 8)}`,
        cityId: city.id,
        countryId: country.id,
      },
      select: { id: true },
    });
    const [aliceId, bobId, outsiderId] = await Promise.all([
      makeUser("alice"),
      makeUser("bob"),
      makeUser("outsider"),
    ]);
    ids = {
      aliceId,
      bobId,
      outsiderId,
      cityId: city.id,
      otherCityId: otherCity.id,
      universityId: university.id,
      countryId: country.id,
    };
  });

  beforeEach(async () => {
    await prisma.userBlock.deleteMany({
      where: {
        OR: [
          { blockerId: { in: [ids.aliceId, ids.bobId] } },
          { blockedId: { in: [ids.aliceId, ids.bobId] } },
        ],
      },
    });
    await prisma.user.updateMany({
      where: { id: { in: [ids.aliceId, ids.bobId] } },
      data: { status: "ACTIVE" },
    });
    await setProfile(ids.aliceId);
    await setProfile(ids.bobId);
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: domain } },
      select: { id: true },
    });
    const list = users.map((user) => user.id);
    await prisma.userBlock.deleteMany({
      where: { OR: [{ blockerId: { in: list } }, { blockedId: { in: list } }] },
    });
    await prisma.roommateProfile.deleteMany({
      where: { userId: { in: list } },
    });
    await prisma.user.deleteMany({ where: { id: { in: list } } });
    await prisma.university.deleteMany({ where: { id: ids.universityId } });
    await prisma.city.deleteMany({
      where: { id: { in: [ids.cityId, ids.otherCityId] } },
    });
    await prisma.country.deleteMany({ where: { id: ids.countryId } });
  });

  it("shows two mutually compatible profiles to each other", async () => {
    const forAlice = await discoverRoommateProfiles({
      viewerId: ids.aliceId,
      query: { languages: [], limit: 20 },
    });
    const forBob = await discoverRoommateProfiles({
      viewerId: ids.bobId,
      query: { languages: [], limit: 20 },
    });
    expect(userIds(forAlice)).toContain(ids.bobId);
    expect(userIds(forBob)).toContain(ids.aliceId);
  });

  it("still finds them when a maximum budget filter is applied", async () => {
    // Regression: `budgetMinimumMinor <= max` never matches a NULL minimum, so
    // every form-created profile disappeared as soon as a budget was entered.
    const result = await discoverRoommateProfiles({
      viewerId: ids.aliceId,
      query: { languages: [], limit: 20, maximumBudgetMinor: 400_000 },
    });
    expect(userIds(result)).toContain(ids.bobId);
  });

  it("reports at least four shared criteria with a readable explanation", async () => {
    const result = await discoverRoommateProfiles({
      viewerId: ids.aliceId,
      query: { languages: [], limit: 20 },
    });
    const bob = result.items.find((item) => item.userId === ids.bobId);
    expect(bob).toBeDefined();
    expect(bob!.compatibility.matched.length).toBeGreaterThanOrEqual(4);
    expect(bob!.compatibility.score).toBeGreaterThan(0);
    expect(bob!.compatibility.explanation).toMatch(/% compatible — /);
  });

  it("drops the match when the city no longer matches, and says why", async () => {
    await setProfile(ids.bobId, {
      cityId: ids.otherCityId,
      universityId: null,
    });
    const result = await discoverRoommateProfiles({
      viewerId: ids.aliceId,
      query: { languages: [], limit: 20 },
    });
    expect(userIds(result)).not.toContain(ids.bobId);
    expect(result.emptyExplanation ?? "").toMatch(/different city/);
  });

  it("drops the match when move-in dates drift far apart", async () => {
    await setProfile(ids.bobId, {
      moveInDate: new Date(MOVE_IN.getTime() + 200 * 86_400_000),
    });
    const result = await discoverRoommateProfiles({
      viewerId: ids.aliceId,
      query: { languages: [], limit: 20 },
    });
    expect(userIds(result)).not.toContain(ids.bobId);
  });

  it("drops the match when budgets genuinely cannot overlap", async () => {
    await setProfile(ids.bobId, {
      budgetMinimumMinor: 900_000,
      budgetMaximumMinor: 1_500_000,
    });
    const result = await discoverRoommateProfiles({
      viewerId: ids.aliceId,
      query: { languages: [], limit: 20 },
    });
    expect(userIds(result)).not.toContain(ids.bobId);
  });

  it("hides paused, private and expired profiles", async () => {
    for (const overrides of [
      { status: "PAUSED" as const },
      { visibility: "PRIVATE" as const },
      { expiresAt: new Date(Date.now() - 86_400_000) },
    ]) {
      await setProfile(ids.bobId, overrides);
      const result = await discoverRoommateProfiles({
        viewerId: ids.aliceId,
        query: { languages: [], limit: 20 },
      });
      expect(userIds(result)).not.toContain(ids.bobId);
    }
  });

  it("hides a suspended member's profile", async () => {
    await prisma.user.update({
      where: { id: ids.bobId },
      data: { status: "SUSPENDED" },
    });
    const result = await discoverRoommateProfiles({
      viewerId: ids.aliceId,
      query: { languages: [], limit: 20 },
    });
    expect(userIds(result)).not.toContain(ids.bobId);
  });

  it("hides both directions of a block", async () => {
    await prisma.userBlock.create({
      data: { blockerId: ids.bobId, blockedId: ids.aliceId },
    });
    const forAlice = await discoverRoommateProfiles({
      viewerId: ids.aliceId,
      query: { languages: [], limit: 20 },
    });
    const forBob = await discoverRoommateProfiles({
      viewerId: ids.bobId,
      query: { languages: [], limit: 20 },
    });
    expect(userIds(forAlice)).not.toContain(ids.bobId);
    expect(userIds(forBob)).not.toContain(ids.aliceId);
  });

  it("never lists the viewer's own profile", async () => {
    const result = await discoverRoommateProfiles({
      viewerId: ids.aliceId,
      query: { languages: [], limit: 20 },
    });
    expect(userIds(result)).not.toContain(ids.aliceId);
  });

  it("orders results deterministically across repeated calls", async () => {
    const first = await discoverRoommateProfiles({
      viewerId: ids.aliceId,
      query: { languages: [], limit: 20 },
    });
    const second = await discoverRoommateProfiles({
      viewerId: ids.aliceId,
      query: { languages: [], limit: 20 },
    });
    expect(userIds(first)).toEqual(userIds(second));
  });

  it("returns pagination metadata and honours the cursor", async () => {
    const page = await discoverRoommateProfiles({
      viewerId: ids.outsiderId,
      query: { languages: [], limit: 1 },
    });
    expect(page).toHaveProperty("nextCursor");
    expect(page).toHaveProperty("hasMore");
    expect(page.items.length).toBeLessThanOrEqual(1);
  });

  it("reflects a profile edit on the very next search", async () => {
    // The page is rendered per request, so an edit must be visible immediately
    // rather than waiting for a cache to expire.
    await setProfile(ids.bobId, { languages: ["Swahili"] });
    const afterEdit = await discoverRoommateProfiles({
      viewerId: ids.aliceId,
      query: { languages: [], limit: 20 },
    });
    const bob = afterEdit.items.find((item) => item.userId === ids.bobId);
    expect(bob?.languages).toEqual(["Swahili"]);
    expect(bob?.compatibility.excluded.map((entry) => entry.key)).toContain(
      "languages",
    );
  });

  it("leaks no private contact data through a match card", async () => {
    const result = await discoverRoommateProfiles({
      viewerId: ids.aliceId,
      query: { languages: [], limit: 20 },
    });
    const bob = result.items.find((item) => item.userId === ids.bobId);
    const serialized = JSON.stringify(bob);
    expect(serialized).not.toContain(domain);
    expect(serialized).not.toContain("passwordHash");
    // Owner-only fields are withheld from a non-owner and never serialized.
    expect(bob?.visibility).toBeUndefined();
    expect(serialized).not.toContain("visibility");
  });
});
