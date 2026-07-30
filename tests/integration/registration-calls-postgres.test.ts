import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPrivateCall,
  findMeetMatch,
  leaveMeetQueue,
} from "@/lib/calls/service";
import { completeOnboarding } from "@/lib/onboarding";
import {
  completeOrganizationOnboarding,
  createOrganizationDraft,
  getOrganizationForSetup,
  listManagedOrganizations,
  updateOrganizationDraft,
} from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import {
  registerHumanUser,
  registerUserWithNationalCommunity,
} from "@/lib/registration";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "registration-calls.test";

postgresDescribe("national registration and call coordination", () => {
  const adminEmail = `admin-${randomUUID()}@${testDomain}`;

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        email: adminEmail,
        firstName: "Global",
        lastName: "Administrator",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      },
    });
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: `@${testDomain}` } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    await prisma.meetQueueEntry.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.callSession.deleteMany({
      where: { participants: { some: { userId: { in: userIds } } } },
    });
    await prisma.organization.deleteMany({
      where: { createdById: { in: userIds } },
    });
    await prisma.community.deleteMany({
      where: {
        type: "COUNTRY",
        isOfficial: true,
        country: { code: { in: ["ZW", "CM", "GH"] } },
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("creates one official country community atomically and keeps students as members", async () => {
    const suffix = randomUUID().replaceAll("-", "");
    const registrations = await Promise.all(
      ["First", "Second"].map((firstName, index) =>
        registerUserWithNationalCommunity({
          email: `${suffix}-${index}@${testDomain}`,
          passwordHash: "not-a-real-password-hash",
          firstName,
          lastName: "Zimbabwe",
          gender: index === 0 ? "FEMALE" : "MALE",
          countryCode: "ZW",
        }),
      ),
    );
    expect(new Set(registrations.map((item) => item.communityId)).size).toBe(1);

    const communities = await prisma.community.findMany({
      where: { type: "COUNTRY", isOfficial: true, country: { code: "ZW" } },
      include: { members: true, country: true },
    });
    expect(communities).toHaveLength(1);
    expect(communities[0]?.name).toBe("Zimbabwe");
    for (const registration of registrations) {
      expect(
        communities[0]?.members.find(
          (membership) => membership.userId === registration.user.id,
        )?.role,
      ).toBe("MEMBER");
      expect(registration.user.countryId).toBe(communities[0]?.countryId);
      expect(registration.user.gender).toBe(
        registration.user.firstName === "First" ? "FEMALE" : "MALE",
      );
      await expect(
        prisma.notification.findUnique({
          where: {
            recipientId_dedupeKey: {
              recipientId: registration.user.id,
              dedupeKey: `account-welcome:${registration.user.id}`,
            },
          },
          select: { type: true, title: true, href: true },
        }),
      ).resolves.toEqual({
        type: "ACCOUNT",
        title: `Welcome to Kondo, ${registration.user.firstName} 👋`,
        href: "/onboarding",
      });
    }
    const testAdmin = await prisma.user.findUniqueOrThrow({
      where: { email: adminEmail },
    });
    expect(
      communities[0]?.members.find(
        (membership) => membership.userId === testAdmin.id,
      )?.role,
    ).toMatch(/OWNER|MODERATOR/);
  });

  it("registers an organization operator as a human and persists independent organization drafts", async () => {
    const suffix = randomUUID().replaceAll("-", "");
    const registration = await registerHumanUser({
      intent: "ORGANIZATION",
      email: `operator-${suffix}@${testDomain}`,
      passwordHash: "not-a-real-password-hash",
      firstName: "Organization",
      lastName: "Operator",
    });
    expect(registration.communityId).toBeNull();
    expect(registration.user.onboardingIntent).toBe("ORGANIZATION");
    expect(registration.user.countryId).toBeNull();
    await expect(
      prisma.communityMember.count({
        where: { userId: registration.user.id },
      }),
    ).resolves.toBe(0);

    const china = await prisma.country.upsert({
      where: { code: "CN" },
      update: { isActive: true, verified: true },
      create: {
        code: "CN",
        name: "China",
        emoji: "🇨🇳",
        isActive: true,
        verified: true,
      },
    });
    const first = await createOrganizationDraft(registration.user, {
      publicName: `Kondo Education ${suffix}`,
      type: "EDUCATION_AGENCY",
      countryId: china.id,
    });
    const second = await createOrganizationDraft(registration.user, {
      publicName: `Kondo Services ${suffix}`,
      type: "SERVICE_PROVIDER",
      countryId: china.id,
    });
    expect(first.id).not.toBe(second.id);
    await expect(
      prisma.organizationMembership.count({
        where: {
          organizationId: first.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.organizationMembership.delete({
        where: {
          organizationId_userId: {
            organizationId: first.id,
            userId: registration.user.id,
          },
        },
      }),
    ).rejects.toThrow(/exactly one active owner/i);
    await expect(
      prisma.organizationMembership.count({
        where: {
          organizationId: first.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      }),
    ).resolves.toBe(1);

    const completed = await completeOrganizationOnboarding(
      registration.user,
      first.id,
      {
        publicName: first.publicName,
        type: first.type,
        countryId: china.id,
        shortDescription:
          "Application guidance and practical support for future students.",
        capabilities: ["STUDENT_SERVICES", "UNIVERSITY_INFORMATION"],
      },
    );
    expect(completed.lifecycleStatus).toBe("ACTIVE");
    expect(completed.verificationStatus).toBe("NOT_SUBMITTED");
    expect(completed.setupCompletedAt).toEqual(expect.any(String));
    expect(completed.capabilities).toEqual([
      "STUDENT_SERVICES",
      "UNIVERSITY_INFORMATION",
    ]);
    await expect(
      listManagedOrganizations(registration.user.id),
    ).resolves.toHaveLength(2);

    const ghana = await prisma.country.upsert({
      where: { code: "GH" },
      update: { isActive: true, verified: true },
      create: {
        code: "GH",
        name: "Ghana",
        emoji: "🇬🇭",
        isActive: true,
        verified: true,
      },
    });
    const personalProfile = await completeOnboarding(registration.user.id, {
      gender: "FEMALE",
      studentJourney: "PROFESSIONAL",
      countryId: ghana.id,
      currentCityName: "Accra",
      professionalArea: "Education",
      chinaRelationship:
        "I help prospective students understand study options in China.",
      languages: ["English"],
      interests: ["Student Guide"],
    });
    expect(personalProfile.studentJourney).toBe("PROFESSIONAL");
    expect(personalProfile.universityId).toBeNull();
    await expect(
      prisma.organizationMembership.count({
        where: { userId: registration.user.id, status: "ACTIVE" },
      }),
    ).resolves.toBe(2);
    await expect(
      prisma.communityMember.count({
        where: {
          userId: registration.user.id,
          community: {
            type: "COUNTRY",
            isOfficial: true,
            countryId: ghana.id,
          },
        },
      }),
    ).resolves.toBe(1);

    const unrelated = await prisma.user.create({
      data: {
        email: `unrelated-${suffix}@${testDomain}`,
        firstName: "Unrelated",
        lastName: "Member",
      },
    });
    await expect(
      getOrganizationForSetup(unrelated, first.id),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      updateOrganizationDraft(unrelated, first.id, {
        shortDescription: "This edit must not be accepted.",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("matches only mutually compatible users and protects the match from duplication", async () => {
    const [cameroon, ghana] = await Promise.all(
      [
        { code: "CM", name: "Cameroon", emoji: "🇨🇲" },
        { code: "GH", name: "Ghana", emoji: "🇬🇭" },
      ].map((country) =>
        prisma.country.upsert({
          where: { code: country.code },
          create: { ...country, verified: true },
          update: {},
        }),
      ),
    );
    const [man, woman] = await Promise.all([
      prisma.user.create({
        data: {
          email: `man-${randomUUID()}@${testDomain}`,
          firstName: "Meet",
          lastName: "Man",
          countryId: cameroon.id,
        },
      }),
      prisma.user.create({
        data: {
          email: `woman-${randomUUID()}@${testDomain}`,
          firstName: "Meet",
          lastName: "Woman",
          countryId: ghana.id,
        },
      }),
    ]);

    await expect(
      findMeetMatch({
        userId: man.id,
        gender: "MALE",
        genderPreference: "FEMALE",
        countryPreferenceId: ghana.id,
      }),
    ).resolves.toEqual({ state: "WAITING" });
    const matched = await findMeetMatch({
      userId: woman.id,
      gender: "FEMALE",
      genderPreference: "MALE",
      countryPreferenceId: cameroon.id,
    });
    expect(matched.state).toBe("MATCHED");
    if (matched.state !== "MATCHED") throw new Error("Expected a match.");

    const callerView = await findMeetMatch({
      userId: man.id,
      gender: "MALE",
      genderPreference: "FEMALE",
      countryPreferenceId: ghana.id,
    });
    expect(callerView).toEqual({ state: "MATCHED", callId: matched.callId });
    await expect(
      prisma.callParticipant.count({
        where: { callSessionId: matched.callId },
      }),
    ).resolves.toBe(2);

    await Promise.all([leaveMeetQueue(man.id), leaveMeetQueue(woman.id)]);

    const conversation = await prisma.conversation.create({
      data: {
        type: "DIRECT",
        directKey: [man.id, woman.id].sort().join(":"),
        participants: {
          create: [{ userId: man.id }, { userId: woman.id }],
        },
      },
    });
    const firstPrivateCall = await createPrivateCall({
      conversationId: conversation.id,
      userId: man.id,
      kind: "VIDEO",
    });
    const reusedPrivateCall = await createPrivateCall({
      conversationId: conversation.id,
      userId: man.id,
      kind: "VIDEO",
    });
    expect(firstPrivateCall).not.toBeNull();
    expect(reusedPrivateCall?.id).toBe(firstPrivateCall?.id);
    await expect(
      prisma.notification.findFirst({
        where: {
          recipientId: woman.id,
          data: { path: ["callId"], equals: firstPrivateCall?.id },
        },
      }),
    ).resolves.not.toBeNull();
  });

  it("keeps incompatible users waiting and removes stale queue presence", async () => {
    const ghana = await prisma.country.findUniqueOrThrow({
      where: { code: "GH" },
    });
    const users = await Promise.all(
      ["first", "second", "fresh"].map((label) =>
        prisma.user.create({
          data: {
            email: `${label}-${randomUUID()}@${testDomain}`,
            firstName: "Queue",
            lastName: label,
            countryId: ghana.id,
            gender: "MALE",
            status: "ACTIVE",
          },
        }),
      ),
    );

    for (const user of users.slice(0, 2)) {
      await expect(
        findMeetMatch({
          userId: user.id,
          gender: "MALE",
          genderPreference: "FEMALE",
          countryPreferenceId: null,
        }),
      ).resolves.toEqual({ state: "WAITING" });
    }
    await expect(
      prisma.callSession.count({
        where: {
          kind: "MEET",
          participants: { some: { userId: { in: users.map(({ id }) => id) } } },
        },
      }),
    ).resolves.toBe(0);

    await prisma.meetQueueEntry.update({
      where: { userId: users[0]!.id },
      data: { heartbeatAt: new Date(Date.now() - 60_000) },
    });
    await findMeetMatch({
      userId: users[2]!.id,
      gender: "MALE",
      genderPreference: "FEMALE",
      countryPreferenceId: null,
    });
    await expect(
      prisma.meetQueueEntry.findUnique({ where: { userId: users[0]!.id } }),
    ).resolves.toBeNull();
    await Promise.all(users.map(({ id }) => leaveMeetQueue(id)));
  });

  it("atomically prevents a queued user from being assigned to two calls", async () => {
    const ghana = await prisma.country.findUniqueOrThrow({
      where: { code: "GH" },
    });
    const users = await Promise.all(
      ["anchor", "candidate-a", "candidate-b"].map((label) =>
        prisma.user.create({
          data: {
            email: `${label}-${randomUUID()}@${testDomain}`,
            firstName: "Atomic",
            lastName: label,
            countryId: ghana.id,
            gender: "MALE",
            status: "ACTIVE",
          },
        }),
      ),
    );
    await findMeetMatch({
      userId: users[0]!.id,
      gender: "MALE",
      genderPreference: "ALL",
      countryPreferenceId: null,
    });

    await Promise.all(
      users.slice(1).map((user) =>
        findMeetMatch({
          userId: user.id,
          gender: "MALE",
          genderPreference: "ALL",
          countryPreferenceId: null,
        }),
      ),
    );

    const calls = await prisma.callSession.findMany({
      where: {
        kind: "MEET",
        participants: { some: { userId: { in: users.map(({ id }) => id) } } },
      },
      include: { participants: true },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.participants).toHaveLength(2);
    expect(
      new Set(calls[0]?.participants.map(({ userId }) => userId)).size,
    ).toBe(2);
    const duplicateAssignments = await prisma.callParticipant.groupBy({
      by: ["userId"],
      where: { userId: { in: users.map(({ id }) => id) } },
      _count: { callSessionId: true },
      having: { callSessionId: { _count: { gt: 1 } } },
    });
    expect(duplicateAssignments).toHaveLength(0);
    await Promise.all(users.map(({ id }) => leaveMeetQueue(id)));
  });

  it("uses shared discovery intentions when selecting a Random candidate", async () => {
    const ghana = await prisma.country.findUniqueOrThrow({
      where: { code: "GH" },
    });
    const [viewer, studyCandidate, languageCandidate] = await Promise.all(
      ["viewer", "study", "language"].map((label) =>
        prisma.user.create({
          data: {
            email: `intent-${label}-${randomUUID()}@${testDomain}`,
            firstName: "Intent",
            lastName: label,
            countryId: ghana.id,
            gender: "FEMALE",
            status: "ACTIVE",
          },
        }),
      ),
    );
    const now = new Date();
    await prisma.meetQueueEntry.createMany({
      data: [
        {
          userId: studyCandidate!.id,
          genderPreference: "ALL",
          mode: "RANDOM",
          intents: ["STUDY"],
          heartbeatAt: now,
        },
        {
          userId: languageCandidate!.id,
          genderPreference: "ALL",
          mode: "RANDOM",
          intents: ["LANGUAGE"],
          heartbeatAt: now,
        },
      ],
    });

    const match = await findMeetMatch({
      userId: viewer!.id,
      gender: "FEMALE",
      genderPreference: "ALL",
      countryPreferenceId: null,
      mode: "RANDOM",
      intents: ["LANGUAGE"],
    });

    expect(match.state).toBe("MATCHED");
    if (match.state !== "MATCHED") throw new Error("Expected a match.");
    const participants = await prisma.callParticipant.findMany({
      where: { callSessionId: match.callId },
      select: { userId: true },
    });
    expect(participants.map(({ userId }) => userId).sort()).toEqual(
      [viewer!.id, languageCandidate!.id].sort(),
    );
    expect(
      participants.some(({ userId }) => userId === studyCandidate!.id),
    ).toBe(false);

    await Promise.all(
      [viewer!, studyCandidate!, languageCandidate!].map(({ id }) =>
        leaveMeetQueue(id),
      ),
    );
  });
});
