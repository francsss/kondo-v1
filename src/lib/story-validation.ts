import { z } from "zod";

export const storyEntityTypes = [
  "CITY",
  "UNIVERSITY",
  "COMMUNITY",
  "COMPANY",
  "INTERNSHIP",
  "EVENT",
] as const;

export const storyStatuses = [
  "DRAFT",
  "UPLOADING",
  "SUBMITTED",
  "PENDING_REVIEW",
  "CHANGES_REQUESTED",
  "RESUBMITTED",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "REJECTED",
  "REMOVED",
  "ARCHIVED",
] as const;

export const storyCreatorStatuses = [
  "STANDARD",
  "AMBASSADOR",
  "APPROVED_CREATOR",
  "TRUSTED_CREATOR",
  "SUSPENDED",
] as const;

export const officialOrganizationTypes = [
  "KONDO",
  "KONDO_TEAM",
  "UNIVERSITY",
  "STUDENT_ASSOCIATION",
  "EMBASSY",
  "ORGANIZATION",
  "ADMINISTRATOR",
  "COMMUNITY",
  "COMPANY",
  "EVENT_ORGANIZER",
  "INSTITUTION",
  "OTHER",
] as const;

export const officialProfileStatuses = [
  "NOT_VERIFIED",
  "STARTED",
  "SUBMITTED",
  "MORE_INFO_REQUIRED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
  "REVOKED",
  "REVIEW_REQUIRED",
] as const;

const entityLinkSchema = z
  .object({
    type: z.enum(storyEntityTypes),
    entityId: z.string().trim().min(1).max(160),
    label: z.string().trim().min(2).max(160).optional(),
    href: z
      .string()
      .trim()
      .max(500)
      .refine(
        (value) =>
          value.startsWith("/") &&
          !value.startsWith("//") &&
          !value.includes("\\"),
        "Use a Kondo path.",
      )
      .optional(),
  })
  .superRefine((value, context) => {
    if (
      ["COMPANY", "INTERNSHIP", "EVENT"].includes(value.type) &&
      (!value.label || !value.href)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Context links need a label and Kondo destination.",
      });
    }
  });

export const storySubmissionSchema = z.object({
  categoryId: z.string().trim().min(1).max(80),
  videoMediaId: z.string().cuid(),
  posterMediaId: z.string().cuid().nullable().optional(),
  title: z.string().trim().min(4).max(120),
  description: z.string().trim().min(10).max(700),
  language: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/)
    .default("en"),
  captions: z.string().trim().max(20_000).nullable().optional(),
  entityLinks: z.array(entityLinkSchema).max(6).default([]),
});

export const storyRevisionSchema = storySubmissionSchema
  .omit({ videoMediaId: true, posterMediaId: true })
  .extend({ posterMediaId: z.string().cuid().nullable().optional() });

export const storyInteractionSchema = z.object({
  action: z.enum(["LIKE", "SAVE", "HIDE"]),
  active: z.boolean().default(true),
  reason: z.string().trim().max(160).nullable().optional(),
});

export const storyCommentSchema = z.object({
  content: z.string().trim().min(1).max(1200),
  parentId: z.string().cuid().nullable().optional(),
});

export const storyReportSchema = z.object({
  reason: z.enum(["SPAM", "HARASSMENT", "SCAM", "INAPPROPRIATE", "OTHER"]),
  details: z.string().trim().max(1000).nullable().optional(),
});

export const storyAdminTransitionSchema = z.object({
  status: z.enum(storyStatuses),
  reason: z.string().trim().min(4).max(1000).nullable().optional(),
  internalNote: z.string().trim().max(1000).nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  isFeatured: z.boolean().optional(),
  isInstitutional: z.boolean().optional(),
  qualityScore: z.number().min(0).max(1).optional(),
});

export const storyCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  description: z.string().trim().max(280).nullable().optional(),
  icon: z.string().trim().max(16).nullable().optional(),
  order: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
});

export const storyCategoryUpdateSchema = storyCategorySchema.partial();

export const storyCreatorStatusSchema = z.object({
  status: z.enum(storyCreatorStatuses),
  reason: z.string().trim().min(4).max(1000),
});

export const verificationRequestSchema = z.object({
  organizationType: z.enum(officialOrganizationTypes),
  organizationName: z.string().trim().min(2).max(160),
  authorityDescription: z.string().trim().min(20).max(1000),
  officialWebsite: z.string().trim().url().max(500).nullable().optional(),
  documents: z
    .array(
      z.object({
        mediaId: z.string().cuid(),
        label: z.string().trim().min(2).max(120),
      }),
    )
    .min(1)
    .max(5),
});

export const verificationAdminDecisionSchema = z.object({
  status: z.enum([
    "MORE_INFO_REQUIRED",
    "UNDER_REVIEW",
    "APPROVED",
    "REJECTED",
    "SUSPENDED",
    "REVOKED",
    "REVIEW_REQUIRED",
  ]),
  reason: z.string().trim().min(8).max(1200),
  nextReviewAt: z.coerce.date().nullable().optional(),
});
