import { describe, expect, it } from "vitest";
import {
  accountRequestAdminSchema,
  accountRequestCreateSchema,
  createAnswerSchema,
  createCommunitySchema,
  createConversationMessageSchema,
  createDirectMessageSchema,
  createListingSchema,
  createPostSchema,
  createQuestionSchema,
  onboardingDraftSchema,
  onboardingSchema,
  mediaAdminRemoveSchema,
  mediaAltTextSchema,
  mediaUploadIntentSchema,
  profileUpdateSchema,
  notificationAnnouncementSchema,
  notificationTemplateUpdateSchema,
  referenceCitySchema,
  referenceCountrySchema,
  referenceUniversitySchema,
  reportAssignmentSchema,
  reportConversationSchema,
  reportNoteSchema,
  reportTransitionSchema,
  registerSchema,
  sessionBulkRevokeSchema,
  settingsPreferencesSchema,
} from "@/lib/validation";

describe("input validation", () => {
  it("accepts a strong, matching registration password", () => {
    expect(
      registerSchema.safeParse({
        firstName: "Ama",
        lastName: "Mensah",
        email: "AMA@example.com",
        password: "StrongPass1",
        confirmPassword: "StrongPass1",
        acceptedTerms: true,
      }).success,
    ).toBe(true);
  });

  it("rejects posts without meaningful content", () => {
    expect(
      createPostSchema.safeParse({
        communityId: "ckz1234567890123456789012",
        content: " ",
      }).success,
    ).toBe(false);
  });

  it("validates community identities, events, and announcement titles", () => {
    expect(
      createCommunitySchema.safeParse({
        name: "Jiaxing Innovators",
        description: "A community connecting students and local innovators.",
        type: "TOPIC",
        isPrivate: false,
        joinPolicy: "REQUEST",
      }).success,
    ).toBe(true);
    expect(
      createCommunitySchema.safeParse({
        name: "Jiaxing University",
        description: "A university community without a university reference.",
        type: "UNIVERSITY",
        isPrivate: false,
        joinPolicy: "OPEN",
      }).success,
    ).toBe(false);
    expect(
      createPostSchema.safeParse({
        communityId: "ckz1234567890123456789012",
        type: "EVENT",
        title: "Jiaxing innovation fair",
        content: "Meet local companies and student founders.",
        eventAt: new Date(Date.now() + 86_400_000),
        eventLocation: "Jiaxing Innovation Center",
      }).success,
    ).toBe(true);
    expect(
      createPostSchema.safeParse({
        communityId: "ckz1234567890123456789012",
        type: "ANNOUNCEMENT",
        content: "An announcement without a title.",
      }).success,
    ).toBe(false);
  });

  it("requires at least one marketplace image", () => {
    expect(
      createListingSchema.safeParse({
        categoryId: "ckz1234567890123456789012",
        cityId: "ckz1234567890123456789012",
        title: "Desk lamp",
        description: "A clean lamp in good condition",
        priceFen: 5000,
        imageIds: [],
        publish: true,
      }).success,
    ).toBe(false);
    expect(
      createListingSchema.safeParse({
        categoryId: "ckz1234567890123456789012",
        cityId: "ckz1234567890123456789012",
        title: "Desk lamp",
        description: "A clean lamp in good condition",
        priceFen: 5000,
        imageIds: [],
        publish: false,
      }).success,
    ).toBe(true);
  });

  it("validates complete and resumable onboarding payloads", () => {
    const references = {
      countryId: "ckz1234567890123456789012",
      cityId: "ckz1234567890123456789013",
      universityId: "ckz1234567890123456789014",
    };
    expect(
      onboardingDraftSchema.safeParse({
        ...references,
        degree: "",
        studyLevel: "MASTERS",
        arrivalDate: "2026-09-01",
        languages: ["English"],
        interests: [],
      }).success,
    ).toBe(true);
    expect(
      onboardingSchema.safeParse({
        ...references,
        degree: "",
        studyLevel: "MASTERS",
        arrivalDate: "2026-09-01",
        languages: ["English"],
        interests: [],
      }).success,
    ).toBe(false);
  });

  it("normalizes and validates reference-data records", () => {
    const country = referenceCountrySchema.safeParse({
      code: "cn",
      name: "China",
      emoji: "🇨🇳",
      isActive: true,
      verified: true,
    });
    expect(country.success && country.data.code).toBe("CN");
    expect(
      referenceCitySchema.safeParse({
        slug: "Invalid Slug",
        name: "Jiaxing",
        countryId: "ckz1234567890123456789012",
      }).success,
    ).toBe(false);
    expect(
      referenceUniversitySchema.safeParse({
        slug: "jiaxing-university",
        name: "Jiaxing University",
        cityId: "ckz1234567890123456789012",
      }).success,
    ).toBe(true);
  });

  it("validates media intents, alt text, and Admin removal reasons", () => {
    expect(
      mediaUploadIntentSchema.safeParse({
        purpose: "PROFILE_AVATAR",
        fileName: "avatar.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 120_000,
        altText: "Portrait of the member",
      }).success,
    ).toBe(true);
    expect(
      mediaUploadIntentSchema.safeParse({
        purpose: "PROFILE_AVATAR",
        fileName: "avatar.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 12 * 1024 * 1024,
        altText: "Portrait",
      }).success,
    ).toBe(false);
    expect(mediaAltTextSchema.safeParse({ altText: " " }).success).toBe(false);
    expect(
      mediaAdminRemoveSchema.safeParse({ reason: "Too short" }).success,
    ).toBe(false);
  });

  it("validates profile visibility and reviewed account requests", () => {
    expect(
      profileUpdateSchema.safeParse({
        firstName: "  Ama ",
        username: "Ama.Mensah",
        bio: "International student in Jiaxing.",
        profileAudience: "MEMBERS",
        locationAudience: "PRIVATE",
      }).success,
    ).toBe(true);
    expect(
      profileUpdateSchema.safeParse({
        username: "invalid username",
        profileAudience: "FRIENDS",
      }).success,
    ).toBe(false);
    expect(
      accountRequestCreateSchema.safeParse({
        type: "ACCOUNT_DELETION",
        reason: "Too short",
      }).success,
    ).toBe(false);
    expect(
      accountRequestCreateSchema.safeParse({
        type: "DATA_EXPORT",
      }).success,
    ).toBe(true);
    expect(
      accountRequestAdminSchema.safeParse({
        status: "COMPLETED",
        expectedVersion: 2,
        responseNote: "Export delivered through the approved secure channel.",
      }).success,
    ).toBe(true);
    expect(
      accountRequestAdminSchema.safeParse({
        status: "REJECTED",
        expectedVersion: 2,
        responseNote: "short",
      }).success,
    ).toBe(false);
  });

  it("validates persisted settings and session revocation scopes", () => {
    expect(
      settingsPreferencesSchema.safeParse({
        theme: "SYSTEM",
        language: "FRENCH",
        notificationMessages: true,
        notificationComments: false,
        emailDigest: "WEEKLY",
      }).success,
    ).toBe(true);
    expect(
      settingsPreferencesSchema.safeParse({
        theme: "AUTO",
        language: "SPANISH",
        emailDigest: "HOURLY",
      }).success,
    ).toBe(false);
    expect(sessionBulkRevokeSchema.safeParse({ scope: "OTHERS" }).success).toBe(
      true,
    );
    expect(sessionBulkRevokeSchema.safeParse({ scope: "USER" }).success).toBe(
      false,
    );
  });

  it("validates bounded notification templates and announcements", () => {
    expect(
      notificationTemplateUpdateSchema.safeParse({
        titleTemplate: "New message from {{actorName}}",
        bodyTemplate: "{{preview}}",
        isActive: true,
        expectedVersion: 2,
      }).success,
    ).toBe(true);
    expect(
      notificationTemplateUpdateSchema.safeParse({
        titleTemplate: "x",
        bodyTemplate: "y".repeat(281),
        isActive: true,
        expectedVersion: 0,
      }).success,
    ).toBe(false);
    expect(
      notificationAnnouncementSchema.safeParse({
        title: "Student services update",
        body: "The service desk will close one hour earlier today.",
        href: "/student-hub",
      }).success,
    ).toBe(true);
  });

  it("validates useful help-center contributions", () => {
    expect(
      createQuestionSchema.safeParse({
        category: "VISA",
        title: "How early should I renew my residence permit?",
        body: "My university closes for part of August and my permit expires soon after.",
      }).success,
    ).toBe(true);
    expect(createAnswerSchema.safeParse({ body: "Too short" }).success).toBe(
      false,
    );
  });

  it("accepts a trimmed direct message and rejects empty or oversized messages", () => {
    expect(
      createDirectMessageSchema.safeParse({
        recipientId: "ckz1234567890123456789012",
        body: "  Hello from Kondo 👋  ",
      }).success,
    ).toBe(true);
    expect(
      createConversationMessageSchema.safeParse({ body: "   " }).success,
    ).toBe(false);
    expect(
      createConversationMessageSchema.safeParse({ body: "x".repeat(2001) })
        .success,
    ).toBe(false);
    expect(
      createConversationMessageSchema.safeParse({
        mediaId: "ckz1234567890123456789012",
      }).success,
    ).toBe(true);
    expect(createConversationMessageSchema.safeParse({}).success).toBe(false);
    expect(
      createDirectMessageSchema.safeParse({
        recipientId: "ckz1234567890123456789012",
        mediaId: "ckz2234567890123456789012",
      }).success,
    ).toBe(true);
  });

  it("requires useful context for an Other conversation report", () => {
    expect(
      reportConversationSchema.safeParse({
        reason: "HARASSMENT",
      }).success,
    ).toBe(true);
    expect(
      reportConversationSchema.safeParse({
        reason: "OTHER",
        details: "Too short",
      }).success,
    ).toBe(false);
    expect(
      reportConversationSchema.safeParse({
        reason: "OTHER",
        details: "The reason needs a manual moderation category.",
      }).success,
    ).toBe(true);
    expect(
      reportConversationSchema.safeParse({
        reason: "NOT_A_REASON",
        details: "An invalid reason must never enter the moderation queue.",
      }).success,
    ).toBe(false);
    expect(
      reportConversationSchema.safeParse({
        reason: "SPAM",
        details: "x".repeat(1_001),
      }).success,
    ).toBe(false);
  });

  it("validates report transition payload boundaries", () => {
    expect(
      reportTransitionSchema.safeParse({
        status: "RESOLVED",
        expectedVersion: 2,
        decision: "VIOLATION_CONFIRMED",
        resolution: "Confirmed after reviewing the preserved evidence.",
      }).success,
    ).toBe(true);
    expect(
      reportTransitionSchema.safeParse({
        status: "OPEN",
        expectedVersion: 2,
      }).success,
    ).toBe(false);
    expect(
      reportTransitionSchema.safeParse({
        status: "DISMISSED",
        expectedVersion: 2,
        decision: "NO_VIOLATION",
        resolution: "short",
      }).success,
    ).toBe(false);
    expect(
      reportAssignmentSchema.safeParse({
        assigneeId: "ckz1234567890123456789012",
        expectedVersion: 2,
      }).success,
    ).toBe(true);
    expect(
      reportAssignmentSchema.safeParse({
        assigneeId: "not-a-user",
        expectedVersion: 0,
      }).success,
    ).toBe(false);
    expect(reportNoteSchema.safeParse({ body: " " }).success).toBe(false);
  });
});
