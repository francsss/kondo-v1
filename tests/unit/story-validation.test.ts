import { describe, expect, it } from "vitest";
import {
  storyAdminTransitionSchema,
  storySubmissionSchema,
  verificationAdminDecisionSchema,
  verificationRequestSchema,
} from "@/lib/story-validation";
import { toSafePublicOfficialFields } from "@/lib/serializers";

const videoMediaId = "cm12345678901234567890123";
const documentMediaId = "cm12345678901234567890124";

describe("Student Stories validation", () => {
  it("accepts a concise Story and safe contextual Kondo links", () => {
    const parsed = storySubmissionSchema.parse({
      categoryId: "practical-life",
      videoMediaId,
      title: "Getting your first metro card",
      description: "A practical walkthrough for newly arrived students.",
      language: "FR",
      entityLinks: [
        {
          type: "EVENT",
          entityId: "welcome-week",
          label: "Welcome week",
          href: "/explore/jiaxing/events/welcome-week",
        },
      ],
    });
    expect(parsed.language).toBe("fr");
    expect(parsed.entityLinks).toHaveLength(1);
  });

  it("rejects external context links and incomplete external entities", () => {
    expect(() =>
      storySubmissionSchema.parse({
        categoryId: "practical-life",
        videoMediaId,
        title: "Useful student guide",
        description: "A sufficiently detailed practical description.",
        entityLinks: [
          {
            type: "COMPANY",
            entityId: "company-id",
            label: "Example company",
            href: "https://example.com",
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      storySubmissionSchema.parse({
        categoryId: "practical-life",
        videoMediaId,
        title: "Useful student guide",
        description: "A sufficiently detailed practical description.",
        entityLinks: [{ type: "INTERNSHIP", entityId: "internship-id" }],
      }),
    ).toThrow("Context links need a label");
  });

  it("bounds moderation decisions and scheduling quality", () => {
    expect(
      storyAdminTransitionSchema.parse({
        status: "SCHEDULED",
        reason: "Editorial publication window.",
        scheduledAt: "2030-01-10T12:00:00.000Z",
        qualityScore: 0.9,
      }),
    ).toMatchObject({ status: "SCHEDULED", qualityScore: 0.9 });
    expect(() =>
      storyAdminTransitionSchema.parse({
        status: "APPROVED",
        qualityScore: 1.5,
      }),
    ).toThrow();
  });
});

describe("Official profile validation", () => {
  it("requires an authority explanation and confidential evidence", () => {
    expect(
      verificationRequestSchema.parse({
        organizationType: "UNIVERSITY",
        organizationName: "International Student Office",
        authorityDescription:
          "I manage official communications for our international students.",
        officialWebsite: "https://university.example.edu",
        documents: [
          {
            mediaId: documentMediaId,
            label: "Letter of authorization",
          },
        ],
      }),
    ).toMatchObject({ organizationType: "UNIVERSITY" });
    expect(() =>
      verificationRequestSchema.parse({
        organizationType: "COMPANY",
        organizationName: "Short",
        authorityDescription: "Too short",
        documents: [],
      }),
    ).toThrow();
  });

  it("requires a meaningful reason for every admin decision", () => {
    expect(
      verificationAdminDecisionSchema.parse({
        status: "APPROVED",
        reason: "Identity and authority were independently confirmed.",
      }),
    ).toMatchObject({ status: "APPROVED" });
    expect(() =>
      verificationAdminDecisionSchema.parse({
        status: "REJECTED",
        reason: "No",
      }),
    ).toThrow();
  });

  it("never exposes pending verification details on public surfaces", () => {
    expect(
      toSafePublicOfficialFields({
        officialProfileStatus: "UNDER_REVIEW",
        officialOrganizationType: "UNIVERSITY",
        officialOrganizationName: "Private review target",
        officialVerifiedAt: null,
      }),
    ).toEqual({
      officialProfileStatus: "NOT_VERIFIED",
      officialOrganizationType: null,
      officialOrganizationName: null,
      officialVerifiedAt: null,
    });
  });
});
