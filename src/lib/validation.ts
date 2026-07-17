import { z } from "zod";

const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/[0-9]/, "Add a number.");

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(2).max(60),
    lastName: z.string().trim().min(2).max(60),
    email: z.string().trim().email().toLowerCase(),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptedTerms: z.literal(true),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1).max(200),
});

const onboardingInterests = z.enum([
  "Housing",
  "Roommate",
  "Community",
  "Marketplace",
  "Internship",
  "Scholarship",
  "Student Guide",
]);

const studyLevelSchema = z.enum([
  "LANGUAGE",
  "BACHELORS",
  "MASTERS",
  "DOCTORATE",
  "EXCHANGE",
  "OTHER",
]);

const onboardingReferenceSchema = {
  countryId: z.string().cuid(),
  cityId: z.string().cuid(),
  universityId: z.string().cuid(),
};

export const onboardingSchema = z.object({
  ...onboardingReferenceSchema,
  degree: z.string().trim().min(2).max(120),
  studyLevel: studyLevelSchema,
  arrivalDate: z.coerce.date(),
  languages: z.array(z.string().trim().min(2).max(40)).min(1).max(8),
  interests: z.array(onboardingInterests).min(1),
});

export const onboardingDraftSchema = z.object({
  ...onboardingReferenceSchema,
  degree: z.string().trim().max(120).optional(),
  studyLevel: studyLevelSchema.optional(),
  arrivalDate: z.coerce.date().optional(),
  languages: z.array(z.string().trim().min(2).max(40)).min(1).max(8).optional(),
  interests: z.array(onboardingInterests).max(7).optional(),
});

const referenceSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(100)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and hyphens.",
  );

export const referenceCountrySchema = z.object({
  code: z.string().trim().length(2).toUpperCase(),
  name: z.string().trim().min(2).max(100),
  emoji: z.string().trim().max(16).nullable().optional(),
  isActive: z.boolean().default(true),
  verified: z.boolean().default(false),
});

export const referenceCitySchema = z.object({
  slug: referenceSlugSchema,
  name: z.string().trim().min(2).max(100),
  province: z.string().trim().max(100).nullable().optional(),
  countryId: z.string().cuid(),
  isActive: z.boolean().default(true),
  verified: z.boolean().default(false),
});

export const referenceUniversitySchema = z.object({
  slug: referenceSlugSchema,
  name: z.string().trim().min(2).max(160),
  shortName: z.string().trim().max(30).nullable().optional(),
  cityId: z.string().cuid(),
  isActive: z.boolean().default(true),
  verified: z.boolean().default(false),
});

export const referenceCountryUpdateSchema = referenceCountrySchema.partial();
export const referenceCityUpdateSchema = referenceCitySchema.partial();
export const referenceUniversityUpdateSchema =
  referenceUniversitySchema.partial();

export const mediaUploadIntentSchema = z.object({
  purpose: z.enum([
    "PROFILE_AVATAR",
    "COMMUNITY_COVER",
    "POST_IMAGE",
    "LISTING_IMAGE",
    "GUIDE_COVER",
    "MESSAGE_IMAGE",
    "MESSAGE_DOCUMENT",
  ]),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(3).max(120),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
  altText: z.string().trim().min(2).max(240).nullable().optional(),
  replacesId: z.string().cuid().optional(),
});

export const mediaAltTextSchema = z.object({
  altText: z.string().trim().min(2).max(240),
});

export const mediaAdminRemoveSchema = z.object({
  reason: z.string().trim().min(10).max(500),
});

const profileAudienceSchema = z.enum(["PUBLIC", "MEMBERS", "PRIVATE"]);

export const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(2).max(60).optional(),
  lastName: z.string().trim().min(2).max(60).optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(30)
    .regex(
      /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/,
      "Use letters, numbers, dots, underscores, or hyphens.",
    )
    .nullable()
    .optional(),
  bio: z.string().trim().max(280).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  avatarMediaId: z.string().cuid().nullable().optional(),
  profileAudience: profileAudienceSchema.optional(),
  locationAudience: profileAudienceSchema.optional(),
  educationAudience: profileAudienceSchema.optional(),
  languagesAudience: profileAudienceSchema.optional(),
  communitiesAudience: profileAudienceSchema.optional(),
  activityAudience: profileAudienceSchema.optional(),
  marketplaceAudience: profileAudienceSchema.optional(),
});

export const accountRequestCreateSchema = z
  .object({
    type: z.enum(["DATA_EXPORT", "ACCOUNT_DELETION"]),
    reason: z.string().trim().max(1000).optional(),
  })
  .superRefine((data, context) => {
    if (
      data.type === "ACCOUNT_DELETION" &&
      (!data.reason || data.reason.length < 10)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please provide at least 10 characters for a deletion request.",
        path: ["reason"],
      });
    }
  });

export const accountRequestCancelSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const accountRequestAdminSchema = z
  .object({
    status: z.enum(["PROCESSING", "COMPLETED", "REJECTED"]),
    expectedVersion: z.number().int().positive(),
    responseNote: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, context) => {
    if (
      (data.status === "COMPLETED" || data.status === "REJECTED") &&
      (!data.responseNote || data.responseNote.length < 10)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A response note of at least 10 characters is required.",
        path: ["responseNote"],
      });
    }
  });

export const settingsPreferencesSchema = z.object({
  theme: z.enum(["LIGHT", "DARK", "SYSTEM"]).optional(),
  language: z.enum(["ENGLISH", "FRENCH", "CHINESE", "ARABIC"]).optional(),
  notificationMessages: z.boolean().optional(),
  notificationComments: z.boolean().optional(),
  notificationMarketplace: z.boolean().optional(),
  notificationAnnouncements: z.boolean().optional(),
  emailDigest: z.enum(["NEVER", "DAILY", "WEEKLY"]).optional(),
});

export const sessionBulkRevokeSchema = z.object({
  scope: z.enum(["OTHERS", "ALL"]),
});

export const notificationTemplateUpdateSchema = z.object({
  titleTemplate: z.string().trim().min(3).max(160),
  bodyTemplate: z.string().trim().max(280).nullable(),
  isActive: z.boolean(),
  expectedVersion: z.number().int().positive(),
});

export const notificationAnnouncementSchema = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(3).max(280),
  href: z.string().trim().max(500).nullable().optional(),
});

export const reactionSchema = z.object({
  type: z.enum(["LIKE", "HELPFUL", "CELEBRATE"]).default("LIKE"),
});

const communityDetailsSchema = z.object({
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(500),
  type: z.enum(["UNIVERSITY", "COUNTRY", "CITY", "TOPIC"]),
  icon: z.string().trim().min(1).max(12).nullable().optional(),
  isPrivate: z.boolean().default(false),
  joinPolicy: z.enum(["OPEN", "REQUEST", "INVITE_ONLY"]).default("OPEN"),
  countryId: z.string().cuid().nullable().optional(),
  cityId: z.string().cuid().nullable().optional(),
  universityId: z.string().cuid().nullable().optional(),
  coverMediaId: z.string().cuid().nullable().optional(),
});

export const createCommunitySchema = communityDetailsSchema.superRefine(
  (data, context) => {
    if (data.type === "UNIVERSITY" && !data.universityId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["universityId"],
        message: "Choose a university for a university community.",
      });
    }
    if (data.type === "CITY" && !data.cityId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cityId"],
        message: "Choose a city for a city community.",
      });
    }
    if (data.type === "COUNTRY" && !data.countryId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["countryId"],
        message: "Choose a country for a country community.",
      });
    }
  },
);

export const updateCommunitySchema = communityDetailsSchema
  .omit({ type: true })
  .partial();

export const transferCommunitySchema = z.object({
  userId: z.string().cuid(),
});

export const communityMemberRoleSchema = z.object({
  role: z.enum(["MEMBER", "MODERATOR"]),
});

export const communityAccessCreateSchema = z.object({
  userId: z.string().cuid().optional(),
  note: z.string().trim().max(500).optional(),
});

export const communityInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  note: z.string().trim().max(500).optional(),
});

export const communityAccessResolutionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  resolution: z.string().trim().max(500).optional(),
});

const postFieldsSchema = z.object({
  type: z
    .enum(["DISCUSSION", "QUESTION", "EVENT", "ANNOUNCEMENT"])
    .default("DISCUSSION"),
  title: z.string().trim().max(180).optional(),
  content: z.string().trim().min(3).max(10_000),
  mediaIds: z.array(z.string().cuid()).max(4).default([]),
  eventAt: z.coerce.date().optional(),
  eventEndsAt: z.coerce.date().optional(),
  eventCapacity: z.coerce.number().int().positive().max(100_000).optional(),
  eventLocation: z.string().trim().max(180).optional(),
});

function validatePostFields(
  data: z.infer<typeof postFieldsSchema>,
  context: z.RefinementCtx,
) {
  if (data.type === "EVENT") {
    if (!data.title || data.title.length < 3) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["title"],
        message: "Events require a title.",
      });
    }
    if (!data.eventAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventAt"],
        message: "Events require a start date.",
      });
    }
    if (!data.eventLocation) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventLocation"],
        message: "Events require a location.",
      });
    }
    if (
      data.eventAt &&
      data.eventEndsAt &&
      data.eventEndsAt < data.eventAt
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventEndsAt"],
        message: "Event end time must follow its start time.",
      });
    }
  }
  if (data.type === "ANNOUNCEMENT" && (!data.title || data.title.length < 3)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["title"],
      message: "Announcements require a title.",
    });
  }
}

export const createPostSchema = postFieldsSchema
  .extend({ communityId: z.string().cuid() })
  .superRefine(validatePostFields);

export const updatePostSchema = postFieldsSchema
  .partial()
  .superRefine((data, context) => {
    if (data.type === "EVENT") {
      validatePostFields(
        {
          type: "EVENT",
          title: data.title,
          content: data.content ?? "unchanged",
          mediaIds: data.mediaIds ?? [],
          eventAt: data.eventAt,
          eventEndsAt: data.eventEndsAt,
          eventCapacity: data.eventCapacity,
          eventLocation: data.eventLocation,
        },
        context,
      );
    }
  });

export const postModerationSchema = z.object({
  action: z.enum([
    "PIN",
    "UNPIN",
    "PUBLISH",
    "VALIDATE_EVENT",
    "REMOVE",
    "RESTORE",
  ]),
});

export const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(5_000),
  parentId: z.string().cuid().optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().trim().min(1).max(5_000),
});

export const adminCommunityUpdateSchema = z.object({
  status: z
    .enum(["PENDING_REVIEW", "ACTIVE", "ARCHIVED", "REMOVED"])
    .optional(),
  isVerified: z.boolean().optional(),
});

export const createListingSchema = z
  .object({
    categoryId: z.string().cuid(),
    cityId: z.string().cuid(),
    title: z.string().trim().min(3).max(140),
    description: z.string().trim().min(10).max(5_000),
    priceFen: z.coerce.number().int().min(0).max(100_000_000),
    isNegotiable: z.boolean().default(false),
    imageIds: z.array(z.string().cuid()).max(8).default([]),
    publish: z.boolean().default(true),
    expiresInDays: z.coerce.number().int().min(7).max(90).default(30),
  })
  .superRefine((data, context) => {
    if (data.publish && data.imageIds.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Published listings require at least one image.",
        path: ["imageIds"],
      });
    }
  });

export const updateListingSchema = z.object({
  categoryId: z.string().cuid().optional(),
  cityId: z.string().cuid().optional(),
  title: z.string().trim().min(3).max(140).optional(),
  description: z.string().trim().min(10).max(5_000).optional(),
  priceFen: z.coerce.number().int().min(0).max(100_000_000).optional(),
  isNegotiable: z.boolean().optional(),
  imageIds: z.array(z.string().cuid()).max(8).optional(),
  expiresInDays: z.coerce.number().int().min(7).max(90).optional(),
});

export const listingTransitionSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "RESERVED", "SOLD", "ARCHIVED"]),
  expiresInDays: z.coerce.number().int().min(7).max(90).optional(),
});

export const marketplaceCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  description: z.string().trim().max(300).nullable().optional(),
  icon: z.string().trim().max(8).nullable().optional(),
  order: z.coerce.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
});

export const adminListingUpdateSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "RESERVED", "SOLD", "ARCHIVED", "EXPIRED", "REMOVED"]).optional(),
  fraudReviewed: z.boolean().optional(),
  moderationNote: z.string().trim().min(10).max(1_000).optional(),
});

export const createQuestionSchema = z.object({
  category: z.enum([
    "VISA",
    "HOUSING",
    "BANK",
    "UNIVERSITY",
    "SCHOLARSHIP",
    "TRAVEL",
    "HEALTH",
  ]),
  title: z.string().trim().min(8).max(180),
  body: z.string().trim().min(20).max(10_000),
});

export const createAnswerSchema = z.object({
  body: z.string().trim().min(10).max(10_000),
});

export const messageBodySchema = z.string().trim().min(1).max(2_000);

export const createDirectMessageSchema = z
  .object({
    recipientId: z.string().cuid(),
    body: messageBodySchema.optional(),
    mediaId: z.string().cuid().optional(),
    sourceType: z.literal("MARKETPLACE_LISTING").optional(),
    sourceId: z.string().cuid().optional(),
  })
  .superRefine((data, context) => {
    if (!data.body && !data.mediaId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A message or attachment is required.",
      });
    }
    if (Boolean(data.sourceType) !== Boolean(data.sourceId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Message source type and ID must be provided together.",
      });
    }
  });

export const createConversationMessageSchema = z
  .object({
    body: messageBodySchema.optional(),
    mediaId: z.string().cuid().optional(),
  })
  .refine((data) => Boolean(data.body || data.mediaId), {
    message: "A message or attachment is required.",
  });

export const conversationReadSchema = z.object({
  latestMessageId: z.string().cuid(),
});

export const conversationArchiveSchema = z.object({
  archived: z.boolean(),
});

export const reportConversationSchema = z
  .object({
    reason: z.enum(["SPAM", "HARASSMENT", "SCAM", "INAPPROPRIATE", "OTHER"]),
    details: z.string().trim().max(1_000).optional(),
  })
  .superRefine((data, context) => {
    if (
      data.reason === "OTHER" &&
      (!data.details || data.details.length < 10)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please provide at least 10 characters for Other reports.",
        path: ["details"],
      });
    }
  });

export const profileReportSchema = reportConversationSchema;
export const contentReportSchema = reportConversationSchema;

export const reportAssignmentSchema = z.object({
  assigneeId: z.string().cuid().nullable(),
  expectedVersion: z.number().int().positive(),
});

export const reportNoteSchema = z.object({
  body: z.string().trim().min(2).max(2_000),
});

export const reportTransitionSchema = z.object({
  status: z.enum(["REVIEWING", "RESOLVED", "DISMISSED"]),
  expectedVersion: z.number().int().positive(),
  decision: z
    .enum([
      "VIOLATION_CONFIRMED",
      "NO_VIOLATION",
      "INSUFFICIENT_EVIDENCE",
      "DUPLICATE",
      "OUT_OF_SCOPE",
      "ESCALATED",
      "OTHER",
    ])
    .optional(),
  resolution: z.string().trim().min(10).max(2_000).optional(),
});
