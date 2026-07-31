import { z } from "zod";
import { ORGANIZATION_TYPE_KEYS } from "@/features/organizations/registry";
import { isAfricanCountryCode } from "@/lib/african-countries";
import { SUPPORTED_CURRENCY_CODES } from "@/lib/currencies";
import { STUDENT_SKILL_CATEGORIES } from "@/lib/peer-marketplace";
import { ORGANIZATION_CAPABILITY_KEYS } from "@/lib/organization-capabilities";
import {
  isHttpWebsiteUrl,
  normalizeOptionalWebsiteUrl,
  WEBSITE_URL_ERROR,
} from "@/lib/website-url";

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
    intent: z.enum(["PERSONAL", "ORGANIZATION"]).default("PERSONAL"),
    gender: z.enum(["MALE", "FEMALE"]).optional(),
    countryCode: z.string().trim().toUpperCase().optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptedTerms: z.literal(true),
  })
  .superRefine((data, context) => {
    if (data.intent === "PERSONAL" && !data.gender) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select your gender.",
        path: ["gender"],
      });
    }
    if (
      data.intent === "PERSONAL" &&
      (!data.countryCode || !isAfricanCountryCode(data.countryCode))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a valid African country.",
        path: ["countryCode"],
      });
    }
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

const studentJourneySchema = z.enum([
  "CURRENT_STUDENT",
  "INCOMING_STUDENT",
  "ALUMNI",
  "PROSPECTIVE_STUDENT",
  "ADMITTED_STUDENT",
  "PROFESSIONAL",
]);

// The onboarding wizard saves a draft after each step, so earlier steps in
// the flow have not chosen a value yet. The client sends "" for an unset
// selector (controlled-input convention); treat that as "not provided yet"
// rather than a malformed id, while still enforcing the cuid format for any
// id that is actually supplied.
const optionalReferenceId = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().cuid().optional(),
);

const optionalDate = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.date().optional(),
);

const optionalTrimmedText = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().trim().max(maximum).optional(),
  );

const clearableTrimmedText = (maximum: number) =>
  z.preprocess(
    (value) =>
      value === null || (typeof value === "string" && !value.trim())
        ? null
        : value,
    z.string().trim().max(maximum).nullable().optional(),
  );

const optionalWebsiteUrl = z.preprocess(
  normalizeOptionalWebsiteUrl,
  z
    .string()
    .trim()
    .url(WEBSITE_URL_ERROR)
    .max(500)
    .refine(isHttpWebsiteUrl, WEBSITE_URL_ERROR)
    .optional(),
);

const personalOnboardingShape = {
  gender: z.enum(["MALE", "FEMALE"]),
  studentJourney: studentJourneySchema,
  countryId: optionalReferenceId,
  cityId: optionalReferenceId,
  universityId: optionalReferenceId,
  degree: optionalTrimmedText(120),
  studyLevel: studyLevelSchema.optional(),
  arrivalDate: optionalDate,
  languages: z.array(z.string().trim().min(2).max(40)).max(8).default([]),
  interests: z.array(onboardingInterests).max(7).default([]),
  applicationStage: z
    .enum([
      "EXPLORING",
      "SEARCHING_SCHOLARSHIPS",
      "PREPARING_APPLICATION",
      "APPLICATION_SUBMITTED",
      "WAITING_FOR_DECISION",
      "ADMITTED",
      "PREPARING_ARRIVAL",
    ])
    .optional(),
  universityPreferenceMode: z
    .enum(["NOT_CHOSEN", "CONSIDERING_SEVERAL", "PREFERRED_SELECTED"])
    .optional(),
  targetCityIds: z.array(z.string().cuid()).max(8).default([]),
  targetUniversityIds: z.array(z.string().cuid()).max(12).default([]),
  expectedIntake: optionalDate,
  campusName: optionalTrimmedText(160),
  graduationYear: z.number().int().min(1900).max(2200).optional(),
  professionalArea: optionalTrimmedText(160),
  currentCityName: optionalTrimmedText(160),
  chinaRelationship: optionalTrimmedText(500),
  currentProfessionalContext: optionalTrimmedText(500),
  arrivalPreparationContext: optionalTrimmedText(500),
};

export const onboardingSchema = z
  .object(personalOnboardingShape)
  .superRefine((data, context) => {
    if (!data.countryId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select your country.",
        path: ["countryId"],
      });
    }
    if (
      ["CURRENT_STUDENT", "ADMITTED_STUDENT", "INCOMING_STUDENT"].includes(
        data.studentJourney,
      )
    ) {
      if (!data.cityId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select your study city.",
          path: ["cityId"],
        });
      }
      if (!data.universityId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select your university.",
          path: ["universityId"],
        });
      }
      if (!data.degree || data.degree.length < 2) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter your program or study field.",
          path: ["degree"],
        });
      }
      if (!data.studyLevel) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select your study level.",
          path: ["studyLevel"],
        });
      }
    }
    if (
      data.studentJourney === "PROSPECTIVE_STUDENT" &&
      !data.studyLevel &&
      (!data.degree || data.degree.length < 2)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select an intended study level or enter an education goal.",
        path: ["studyLevel"],
      });
    }
    if (data.studentJourney === "PROFESSIONAL") {
      for (const [path, value, message] of [
        ["currentCityName", data.currentCityName, "Enter your current city."],
        [
          "professionalArea",
          data.professionalArea,
          "Enter your professional area.",
        ],
        [
          "chinaRelationship",
          data.chinaRelationship,
          "Explain your professional connection with China.",
        ],
      ] as const) {
        if (!value || value.length < 2) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message,
            path: [path],
          });
        }
      }
    }
    if (
      data.universityPreferenceMode === "PREFERRED_SELECTED" &&
      data.targetUniversityIds.length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one preferred university.",
        path: ["targetUniversityIds"],
      });
    }
  });

export const onboardingDraftSchema = z.object({
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  studentJourney: studentJourneySchema.optional(),
  countryId: optionalReferenceId,
  cityId: optionalReferenceId,
  universityId: optionalReferenceId,
  degree: z.string().trim().max(120).optional(),
  studyLevel: studyLevelSchema.optional(),
  arrivalDate: optionalDate,
  languages: z.array(z.string().trim().min(2).max(40)).min(1).max(8).optional(),
  interests: z.array(onboardingInterests).max(7).optional(),
  applicationStage: personalOnboardingShape.applicationStage,
  universityPreferenceMode: personalOnboardingShape.universityPreferenceMode,
  targetCityIds: z.array(z.string().cuid()).max(8).optional(),
  targetUniversityIds: z.array(z.string().cuid()).max(12).optional(),
  expectedIntake: optionalDate,
  campusName: optionalTrimmedText(160),
  graduationYear: z.number().int().min(1900).max(2200).optional(),
  professionalArea: optionalTrimmedText(160),
  currentCityName: optionalTrimmedText(160),
  chinaRelationship: optionalTrimmedText(500),
  currentProfessionalContext: optionalTrimmedText(500),
  arrivalPreparationContext: optionalTrimmedText(500),
  onboardingStep: z.number().int().min(0).max(5).optional(),
});

const optionalCuid = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().cuid().optional(),
);

const organizationTypeSchema = z.enum(ORGANIZATION_TYPE_KEYS);

export const organizationDraftCreateSchema = z.object({
  publicName: z.string().trim().min(2).max(160),
  type: organizationTypeSchema,
  countryId: z.string().cuid(),
  cityId: optionalCuid,
});

export const organizationOnboardingDraftSchema = z.object({
  publicName: z.string().trim().min(2).max(160).optional(),
  legalName: optionalTrimmedText(200),
  type: organizationTypeSchema.optional(),
  countryId: z.string().cuid().optional(),
  cityId: optionalCuid,
  shortDescription: optionalTrimmedText(500),
  website: optionalWebsiteUrl,
  professionalEmail: z
    .preprocess(
      (value) =>
        typeof value === "string" && !value.trim() ? undefined : value,
      z.string().trim().email().max(320).optional(),
    )
    .optional(),
  professionalPhone: optionalTrimmedText(40),
  logoMediaId: optionalCuid,
  capabilities: z.array(z.enum(ORGANIZATION_CAPABILITY_KEYS)).max(7).optional(),
  setupStep: z.number().int().min(1).max(4).optional(),
});

export const organizationOnboardingCompleteSchema =
  organizationOnboardingDraftSchema.extend({
    publicName: z.string().trim().min(2).max(160),
    type: organizationTypeSchema,
    countryId: z.string().cuid(),
    shortDescription: z.string().trim().min(20).max(500),
    capabilities: z.array(z.enum(ORGANIZATION_CAPABILITY_KEYS)).min(1).max(7),
    confirm: z.literal(true),
  });

const organizationVisibleRoleSchema = z.enum(["ADMIN", "EDITOR", "VIEWER"]);
const organizationSizeRangeSchema = z.enum([
  "SOLO",
  "TWO_TO_TEN",
  "ELEVEN_TO_FIFTY",
  "FIFTY_ONE_TO_TWO_HUNDRED",
  "TWO_HUNDRED_PLUS",
]);

export const organizationProfileUpdateSchema = z.object({
  publicName: z.string().trim().min(2).max(160).optional(),
  legalName: optionalTrimmedText(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(100)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and hyphens.",
    )
    .optional(),
  type: organizationTypeSchema.optional(),
  tagline: optionalTrimmedText(160),
  shortDescription: optionalTrimmedText(500),
  extendedDescription: optionalTrimmedText(5_000),
  foundingYear: z.number().int().min(1000).max(2200).optional(),
  sizeRange: organizationSizeRangeSchema.optional(),
  countryId: z.string().cuid().optional(),
  cityId: optionalCuid,
  website: optionalWebsiteUrl,
  professionalEmail: z
    .preprocess(
      (value) =>
        typeof value === "string" && !value.trim() ? undefined : value,
      z.string().trim().email().max(320).optional(),
    )
    .optional(),
  professionalPhone: optionalTrimmedText(40),
  websiteWechat: optionalTrimmedText(120),
  publicAddress: optionalTrimmedText(300),
  serviceAreas: z.array(z.string().trim().min(2).max(120)).max(30).optional(),
  supportedLanguages: z
    .array(z.string().trim().min(2).max(40))
    .max(20)
    .optional(),
  contactAudience: z.enum(["PUBLIC", "MEMBERS", "PRIVATE"]).optional(),
  logoMediaId: optionalCuid,
  coverMediaId: optionalCuid,
});

export const organizationCapabilitiesUpdateSchema = z.object({
  capabilities: z.array(z.enum(ORGANIZATION_CAPABILITY_KEYS)).max(7),
});

export const organizationInvitationCreateSchema = z.object({
  email: z.string().trim().email().max(320).toLowerCase(),
  role: organizationVisibleRoleSchema,
});

export const organizationInvitationUpdateSchema = z.object({
  action: z.enum(["RESEND", "CANCEL"]),
  role: organizationVisibleRoleSchema.optional(),
});

export const organizationMemberUpdateSchema = z.object({
  role: organizationVisibleRoleSchema,
});

export const organizationOwnershipTransferCreateSchema = z.object({
  targetUserId: z.string().cuid(),
  confirm: z.literal(true),
});

export const organizationInvitationDecisionSchema = z.object({
  action: z.enum(["ACCEPT", "DECLINE"]),
});

const organizationVerificationDocumentTypeSchema = z.enum([
  "BUSINESS_REGISTRATION",
  "UNIVERSITY_AUTHORIZATION",
  "ASSOCIATION_REGISTRATION",
  "REPRESENTATIVE_AUTHORIZATION",
  "OFFICIAL_LETTER",
  "ADDRESS_PROOF",
  "OTHER",
]);

export const organizationVerificationDraftSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  registrationNumber: optionalTrimmedText(160),
  registrationCountryId: z.string().cuid(),
  authorityDescription: z.string().trim().min(20).max(1_200),
  officialWebsite: z
    .preprocess(
      (value) =>
        typeof value === "string" && !value.trim() ? undefined : value,
      z.string().trim().url().max(500).optional(),
    )
    .optional(),
  publicContactEmail: z.string().trim().email().max(320).toLowerCase(),
  documents: z
    .array(
      z.object({
        mediaId: z.string().cuid(),
        type: organizationVerificationDocumentTypeSchema,
        label: z.string().trim().min(2).max(120),
      }),
    )
    .max(12),
});

export const organizationVerificationSubmitSchema =
  organizationVerificationDraftSchema.extend({
    confirm: z.literal(true),
    documents: z
      .array(
        z.object({
          mediaId: z.string().cuid(),
          type: organizationVerificationDocumentTypeSchema,
          label: z.string().trim().min(2).max(120),
        }),
      )
      .min(1)
      .max(12),
  });

export const organizationVerificationDecisionSchema = z.object({
  status: z.enum([
    "UNDER_REVIEW",
    "MORE_INFORMATION_REQUIRED",
    "APPROVED",
    "REJECTED",
    "SUSPENDED",
    "REVOKED",
  ]),
  userVisibleResponse: z.string().trim().min(4).max(1_200),
  reviewerNote: optionalTrimmedText(2_000),
});

export const organizationLifecycleUpdateSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]),
  reason: z.string().trim().min(4).max(1_200),
});

export const organizationPartnerUpdateSchema = z.object({
  isOfficialPartner: z.boolean(),
  reason: z.string().trim().min(4).max(1_200),
});

export const organizationContactChannelSchema = z.object({
  id: optionalCuid,
  type: z.enum(["WEBSITE", "EMAIL", "PHONE", "WECHAT", "WHATSAPP", "OTHER"]),
  label: optionalTrimmedText(80),
  value: z.string().trim().min(2).max(500),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
});

export const organizationPublicProfileUpdateSchema = z.object({
  tagline: clearableTrimmedText(160),
  shortDescription: clearableTrimmedText(500),
  extendedDescription: clearableTrimmedText(5_000),
  publicAddress: clearableTrimmedText(300),
  serviceAreas: z.array(z.string().trim().min(2).max(120)).max(30),
  supportedLanguages: z.array(z.string().trim().min(2).max(40)).max(20),
  representationConfirmed: z.boolean(),
  contacts: z.array(organizationContactChannelSchema).max(12),
});

export const organizationPublicationSchema = z.object({
  confirm: z.literal(true),
});

export const organizationGalleryCreateSchema = z.object({
  mediaId: z.string().cuid(),
  caption: optionalTrimmedText(240),
  altText: z.string().trim().min(2).max(240),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
});

export const organizationGalleryUpdateSchema = z.object({
  caption: optionalTrimmedText(240),
  altText: z.string().trim().min(2).max(240).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  sortOrder: z.number().int().min(0).max(30).optional(),
});

export const organizationGalleryReorderSchema = z.object({
  mediaIds: z.array(z.string().cuid()).min(1).max(12),
});

export const organizationReportSchema = z.object({
  category: z.enum([
    "MISLEADING_IDENTITY",
    "IMPERSONATION",
    "SCAM_OR_FRAUD",
    "UNSAFE_HOUSING_CLAIM",
    "FALSE_SCHOLARSHIP_CLAIM",
    "SUSPICIOUS_JOB",
    "PROHIBITED_SERVICE",
    "INAPPROPRIATE_CONTENT",
    "OUTDATED_INFORMATION",
    "OTHER",
  ]),
  details: z.string().trim().min(10).max(1_000),
});

export const organizationPublicModerationSchema = z.object({
  action: z.enum(["REQUEST_CORRECTION", "UNPUBLISH", "RESTORE"]),
  reason: z.string().trim().min(10).max(1_200),
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

export const mediaUploadIntentSchema = z
  .object({
    purpose: z.enum([
      "PROFILE_AVATAR",
      "ORGANIZATION_LOGO",
      "ORGANIZATION_COVER",
      "ORGANIZATION_GALLERY_IMAGE",
      "ORGANIZATION_VERIFICATION_DOCUMENT",
      "COMMUNITY_COVER",
      "POST_IMAGE",
      "LISTING_IMAGE",
      "GUIDE_COVER",
      "MESSAGE_IMAGE",
      "MESSAGE_DOCUMENT",
      "SCHEDULE_IMPORT",
      "STORY_VIDEO",
      "STORY_POSTER",
      "VERIFICATION_DOCUMENT",
    ]),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(3).max(120),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(25 * 1024 * 1024),
    altText: z.string().trim().min(2).max(240).nullable().optional(),
    replacesId: z.string().cuid().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.purpose !== "SCHEDULE_IMPORT" &&
      value.purpose !== "STORY_VIDEO" &&
      value.sizeBytes > 10 * 1024 * 1024
    ) {
      context.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: 10 * 1024 * 1024,
        type: "number",
        inclusive: true,
        message: "File size exceeds the generic media limit.",
      });
    }
  });

export const mediaAltTextSchema = z.object({
  altText: z.string().trim().min(2).max(240),
});

const peerOfferCityId = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().cuid().optional(),
);
const peerAmount = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z
    .string()
    .trim()
    .max(40)
    .regex(/^[0-9][0-9., ]*$/, "Use a valid amount.")
    .optional(),
);
const peerCurrency = z
  .string()
  .trim()
  .toUpperCase()
  .refine(
    (value) => SUPPORTED_CURRENCY_CODES.has(value),
    "Select a supported currency.",
  );

export const communityExchangeOfferSchema = z
  .object({
    cityId: peerOfferCityId,
    haveCurrency: peerCurrency,
    needCurrency: peerCurrency,
    haveAmount: peerAmount,
    needAmount: peerAmount,
    note: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.haveCurrency !== value.needCurrency, {
    message: "Choose two different currencies.",
    path: ["needCurrency"],
  });

export const studentSkillOfferSchema = z.object({
  cityId: peerOfferCityId,
  title: z.string().trim().min(4).max(120),
  category: z.enum(STUDENT_SKILL_CATEGORIES),
  description: z.string().trim().min(10).max(700),
  availability: z.string().trim().max(160).optional(),
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
        message:
          "Please provide at least 10 characters for a deletion request.",
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
  notificationHousing: z.boolean().optional(),
  notificationAnnouncements: z.boolean().optional(),
  notificationCommunity: z.boolean().optional(),
  notificationMeet: z.boolean().optional(),
  notificationAcademic: z.boolean().optional(),
  notificationRecommendations: z.boolean().optional(),
  notificationFriends: z.boolean().optional(),
  notificationEvents: z.boolean().optional(),
  notificationTransfers: z.boolean().optional(),
  notificationUniversity: z.boolean().optional(),
  notificationSecurity: z.boolean().optional(),
  notificationMarketing: z.boolean().optional(),
  notificationSounds: z.boolean().optional(),
  notificationHaptics: z.boolean().optional(),
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
  audience: z
    .discriminatedUnion("type", [
      z.object({ type: z.literal("ALL") }),
      z.object({ type: z.literal("CITY"), id: z.string().cuid() }),
      z.object({ type: z.literal("COMMUNITY"), id: z.string().cuid() }),
      z.object({ type: z.literal("UNIVERSITY"), id: z.string().cuid() }),
    ])
    .default({ type: "ALL" }),
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
    if (data.eventAt && data.eventEndsAt && data.eventEndsAt < data.eventAt) {
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

export const createCommunityRequestSchema = z
  .object({
    category: z.enum([
      "ACADEMIC",
      "HOUSING",
      "TRANSPORT",
      "DOCUMENTS",
      "HEALTH",
      "OTHER",
    ]),
    priority: z.enum(["URGENT", "IMPORTANT", "NORMAL"]).default("NORMAL"),
    title: z.string().trim().min(3).max(140),
    description: z.string().trim().min(10).max(500),
    expiresAt: z.coerce.date(),
  })
  .superRefine((data, context) => {
    const now = Date.now();
    if (data.expiresAt.getTime() < now + 15 * 60_000) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expiration must be at least 15 minutes from now.",
        path: ["expiresAt"],
      });
    }
    if (data.expiresAt.getTime() > now + 30 * 24 * 60 * 60_000) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Requests can remain active for up to 30 days.",
        path: ["expiresAt"],
      });
    }
  });

export const closeCommunityRequestSchema = z.object({
  status: z.literal("CLOSED"),
});

export const adminCommunityUpdateSchema = z.object({
  status: z
    .enum(["PENDING_REVIEW", "ACTIVE", "ARCHIVED", "REMOVED"])
    .optional(),
  isVerified: z.boolean().optional(),
  name: z.string().trim().min(3).max(100).optional(),
  description: z.string().trim().min(10).max(500).optional(),
  icon: z.string().trim().min(1).max(12).nullable().optional(),
  joinPolicy: z.enum(["OPEN", "REQUEST", "INVITE_ONLY"]).optional(),
  isPrivate: z.boolean().optional(),
});

export const adminOfficialCommunitySchema = createCommunitySchema;

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
  status: z
    .enum([
      "DRAFT",
      "ACTIVE",
      "RESERVED",
      "SOLD",
      "ARCHIVED",
      "EXPIRED",
      "REMOVED",
    ])
    .optional(),
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

// --- Module 14: email verification & password reset ---

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
});

export const confirmPasswordResetSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: passwordSchema,
});

export const confirmEmailVerificationSchema = z.object({
  token: z.string().trim().min(20).max(200),
});

// --- Module 17: Admin user status control ---

export const adminUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]),
  reason: z.string().trim().min(5).max(500),
});

export const adminUserRoleSchema = z.object({
  role: z.enum(["MEMBER", "MODERATOR", "ADMIN", "SUPER_ADMIN"]),
  reason: z.string().trim().min(5).max(500),
});

// --- Module 17: Guide CMS ---

const guideCategorySchema = z.enum([
  "BEFORE_DEPARTURE",
  "ARRIVAL",
  "RESIDENCY",
  "DAILY_LIFE",
  "MONEY",
  "TRANSPORT",
  "HEALTH",
  "UNIVERSITY",
]);

export const createGuideSchema = z.object({
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().min(10).max(500),
  category: guideCategorySchema,
  estimatedMinutes: z.number().int().min(1).max(600),
  featured: z.boolean().optional(),
  coverMediaId: z.string().cuid().nullable().optional(),
});

export const updateGuideSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    summary: z.string().trim().min(10).max(500),
    category: guideCategorySchema,
    estimatedMinutes: z.number().int().min(1).max(600),
    featured: z.boolean(),
    coverMediaId: z.string().cuid().nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

export const guidePublishSchema = z.object({
  published: z.boolean(),
});

export const guideStepSchema = z.object({
  order: z.number().int().min(1).max(100),
  title: z.string().trim().min(3).max(160),
  content: z.string().trim().min(3).max(10_000),
  actionUrl: z
    .string()
    .trim()
    .url()
    .max(500)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
});

// --- Module 20: City Hub editorial workflow ---

// Zod mirror of the ExploreCity type in src/features/explore/types.ts. This is
// the integrity gate for editorial content: a draft can be saved and a hub can
// be published only if its payload conforms to exactly this shape, so the
// public explore pages can render DB content with the same guarantees as the
// static registry.
const exploreIconSchema = z.enum([
  "companies",
  "products",
  "universities",
  "jobs",
  "events",
  "services",
  "about",
]);

const exploreAccentSchema = z.enum([
  "emerald",
  "amber",
  "blue",
  "violet",
  "rose",
  "cyan",
  "slate",
]);

const exploreEntryTypeSchema = z.enum([
  "company",
  "product",
  "university",
  "opportunity",
  "event",
  "service",
  "story",
]);

export const exploreEntrySchema = z.object({
  id: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and dashes only."),
  type: exploreEntryTypeSchema,
  title: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(600),
  location: z.string().trim().max(160).optional(),
  status: z.string().trim().max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(20),
  details: z.array(z.string().trim().min(1).max(400)).max(20),
  source: z
    .object({
      label: z.string().trim().min(1).max(120),
      href: z.string().trim().url().max(500),
    })
    .optional(),
});

export const exploreSectionSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and dashes only."),
  title: z.string().trim().min(1).max(160),
  shortTitle: z.string().trim().min(1).max(80),
  eyebrow: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(600),
  description: z.string().trim().min(1).max(1_200),
  icon: exploreIconSchema,
  accent: exploreAccentSchema,
  signal: z.string().trim().min(1).max(160),
  studentValue: z.string().trim().min(1).max(400),
  cityValue: z.string().trim().min(1).max(400),
  entries: z.array(exploreEntrySchema).max(50),
});

export const exploreCityPayloadSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and dashes only."),
  name: z.string().trim().min(1).max(120),
  province: z.string().trim().min(1).max(120),
  country: z.string().trim().min(1).max(120),
  eyebrow: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(160),
  tagline: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(600),
  description: z.string().trim().min(1).max(1_200),
  signals: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        value: z.string().trim().min(1).max(160),
      }),
    )
    .max(12),
  impactPoints: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().min(1).max(400),
      }),
    )
    .max(12),
  sections: z.array(exploreSectionSchema).min(1).max(12),
});

export const cityHubCreateSchema = z.object({
  // The server resolves every other field from the active onboarding city.
  // This prevents administrators from creating orphan or misspelled hubs.
  cityId: z.string().trim().min(1).max(80),
});

export const cityHubDetailsUpdateSchema = z.object({
  payload: exploreCityPayloadSchema.omit({ sections: true }),
  expectedVersion: z.number().int().positive(),
});

export const cityHubSectionUpdateSchema = z.object({
  payload: exploreSectionSchema.omit({ entries: true }),
  expectedVersion: z.number().int().positive(),
});

export const cityHubEntryCreateSchema = z.object({
  payload: exploreEntrySchema,
  expectedVersion: z.number().int().positive(),
});

export const cityHubEntryUpdateSchema = cityHubEntryCreateSchema;

export const cityHubStatusSchema = z.object({
  status: z.enum(["DRAFT", "REVIEW", "PUBLISHED"]),
  expectedVersion: z.number().int().positive(),
});

export const cityHubVersionSchema = z.object({
  expectedVersion: z.number().int().positive(),
});
