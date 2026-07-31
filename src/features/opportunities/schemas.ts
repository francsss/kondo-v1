import { z } from "zod";
import { OPPORTUNITY_TYPE_KEYS } from "@/lib/opportunity-types";
import { isHttpWebsiteUrl, normalizeWebsiteUrl } from "@/lib/website-url";

/**
 * Validation for the Opportunities domain.
 *
 * External URLs are normalized and then required to be plain http(s), which
 * rejects javascript:, data: and other active schemes before a value can reach
 * the database or a rendered link.
 */

const externalUrl = z
  .string()
  .trim()
  .max(500)
  .transform(normalizeWebsiteUrl)
  .refine(isHttpWebsiteUrl, {
    message: "Enter a valid https:// web address.",
  });

export const opportunityTypeSchema = z.enum(OPPORTUNITY_TYPE_KEYS);

export const applicationMethodSchema = z.enum([
  "KONDO_APPLICATION",
  "EXTERNAL_URL",
  "EMAIL",
  "INFORMATION_ONLY",
  "NOMINATION_REQUIRED",
]);

export const opportunityDraftSchema = z
  .object({
    type: opportunityTypeSchema,
    title: z.string().trim().min(6).max(180),
    shortDescription: z.string().trim().min(20).max(400),
    description: z.string().trim().min(50).max(20_000),
    countryId: z.string().cuid().optional().nullable(),
    cityId: z.string().cuid().optional().nullable(),
    universityId: z.string().cuid().optional().nullable(),
    locationLabel: z.string().trim().max(200).optional().nullable(),
    workMode: z
      .enum(["ON_SITE", "REMOTE", "HYBRID", "CAMPUS", "UNSPECIFIED"])
      .default("UNSPECIFIED"),
    applicationMethod: applicationMethodSchema,
    externalApplicationUrl: externalUrl.optional().nullable(),
    applicationEmail: z.string().trim().email().max(320).optional().nullable(),
    officialSourceUrl: externalUrl.optional().nullable(),
    applicationOpenAt: z.coerce.date().optional().nullable(),
    applicationDeadline: z.coerce.date().optional().nullable(),
    rollingApplications: z.boolean().default(false),
    expectedDecisionDate: z.coerce.date().optional().nullable(),
    opportunityStartDate: z.coerce.date().optional().nullable(),
    opportunityEndDate: z.coerce.date().optional().nullable(),
    timezone: z.string().trim().max(64).default("Asia/Shanghai"),
    degreeLevels: z.array(z.string().trim().max(40)).max(12).default([]),
    fieldsOfStudy: z.array(z.string().trim().max(80)).max(20).default([]),
  })
  .superRefine((value, ctx) => {
    // The chosen application method must actually carry the destination it
    // implies, so the public page can never show an apply action that goes
    // nowhere.
    if (
      value.applicationMethod === "EXTERNAL_URL" &&
      !value.externalApplicationUrl
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["externalApplicationUrl"],
        message: "Add the official application web address.",
      });
    }
    if (value.applicationMethod === "EMAIL" && !value.applicationEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["applicationEmail"],
        message: "Add the application email address.",
      });
    }
    if (
      value.applicationDeadline &&
      value.applicationOpenAt &&
      value.applicationDeadline <= value.applicationOpenAt
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["applicationDeadline"],
        message: "The deadline must be after the opening date.",
      });
    }
    if (
      value.opportunityEndDate &&
      value.opportunityStartDate &&
      value.opportunityEndDate < value.opportunityStartDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["opportunityEndDate"],
        message: "The end date must be after the start date.",
      });
    }
  });

export const scholarshipDetailSchema = z.object({
  fundingType: z.enum([
    "FULLY_FUNDED",
    "PARTIALLY_FUNDED",
    "TUITION_ONLY",
    "STIPEND_ONLY",
    "FEE_WAIVER",
    "OTHER",
  ]),
  tuitionCoverage: z.string().trim().max(300).optional().nullable(),
  accommodationCoverage: z.string().trim().max(300).optional().nullable(),
  monthlyStipendMinor: z
    .number()
    .int()
    .min(0)
    .max(100_000_000)
    .optional()
    .nullable(),
  stipendCurrency: z.string().trim().length(3).optional().nullable(),
  insuranceCoverage: z.string().trim().max(300).optional().nullable(),
  travelCoverage: z.string().trim().max(300).optional().nullable(),
  nominationRequired: z.boolean().default(false),
  targetPrograms: z.array(z.string().trim().max(160)).max(30).default([]),
  intakeLabel: z.string().trim().max(120).optional().nullable(),
  studyLanguage: z.string().trim().max(80).optional().nullable(),
  durationLabel: z.string().trim().max(120).optional().nullable(),
  renewalConditions: z.string().trim().max(1000).optional().nullable(),
});

export const jobDetailSchema = z
  .object({
    employmentType: z.enum([
      "INTERNSHIP",
      "PART_TIME",
      "FULL_TIME",
      "TEMPORARY",
      "CONTRACT",
      "CAMPUS",
      "VOLUNTEER",
      "RESEARCH_ASSISTANT",
      "TEACHING_ASSISTANT",
    ]),
    roleTitle: z.string().trim().max(180).optional().nullable(),
    department: z.string().trim().max(160).optional().nullable(),
    experienceLevel: z
      .enum([
        "NO_EXPERIENCE",
        "ENTRY_LEVEL",
        "INTERMEDIATE",
        "EXPERIENCED",
        "UNSPECIFIED",
      ])
      .default("UNSPECIFIED"),
    weeklyHours: z.number().int().min(1).max(80).optional().nullable(),
    durationLabel: z.string().trim().max(120).optional().nullable(),
    salaryMinMinor: z.number().int().min(0).optional().nullable(),
    salaryMaxMinor: z.number().int().min(0).optional().nullable(),
    salaryCurrency: z.string().trim().length(3).optional().nullable(),
    salaryPeriod: z
      .enum(["HOUR", "DAY", "WEEK", "MONTH", "YEAR", "TOTAL"])
      .optional()
      .nullable(),
    salaryNegotiable: z.boolean().default(false),
    paid: z.boolean().optional().nullable(),
    // Tri-state on purpose: null means "not stated", which the UI must not
    // render as either a promise or a denial.
    visaSupport: z.boolean().optional().nullable(),
    housingSupport: z.boolean().optional().nullable(),
    conversionPotential: z.boolean().optional().nullable(),
    numberOfOpenings: z.number().int().min(1).max(9999).optional().nullable(),
    technicalSkills: z.array(z.string().trim().max(60)).max(30).default([]),
    softSkills: z.array(z.string().trim().max(60)).max(30).default([]),
  })
  .superRefine((value, ctx) => {
    if (
      value.salaryMinMinor !== null &&
      value.salaryMinMinor !== undefined &&
      !value.salaryCurrency
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salaryCurrency"],
        message: "Add the currency for the stated compensation.",
      });
    }
    if (
      value.salaryMinMinor != null &&
      value.salaryMaxMinor != null &&
      value.salaryMaxMinor < value.salaryMinMinor
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salaryMaxMinor"],
        message: "The maximum must be at least the minimum.",
      });
    }
  });

export const eligibilityRuleSchema = z.object({
  ruleType: z.enum([
    "ACCOUNT_JOURNEY",
    "STUDENT_STATUS",
    "DEGREE_LEVEL",
    "UNIVERSITY",
    "FIELD_OF_STUDY",
    "GRADUATION_YEAR",
    "COUNTRY",
    "NATIONALITY",
    "RESIDENCE",
    "AGE",
    "GPA",
    "LANGUAGE",
    "EXPERIENCE",
    "SKILL",
    "AVAILABILITY",
    "ENROLLMENT_STATUS",
    "CUSTOM",
  ]),
  operator: z.enum([
    "EQUALS",
    "NOT_EQUALS",
    "IN",
    "NOT_IN",
    "AT_LEAST",
    "AT_MOST",
    "BETWEEN",
    "EXISTS",
    "CUSTOM",
  ]),
  structuredValue: z.unknown(),
  required: z.boolean().default(true),
  publicLabel: z.string().trim().min(3).max(300),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const applicationQuestionSchema = z.object({
  type: z.enum([
    "SHORT_TEXT",
    "LONG_TEXT",
    "SELECT",
    "MULTI_SELECT",
    "DATE",
    "NUMBER",
    "BOOLEAN",
    "FILE",
    "CONSENT",
  ]),
  label: z.string().trim().min(3).max(300),
  description: z.string().trim().max(600).optional().nullable(),
  required: z.boolean().default(true),
  // Options are plain strings only — never arbitrary structures that could be
  // interpreted as logic.
  options: z.array(z.string().trim().min(1).max(160)).max(30).optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const applicationRequirementSchema = z.object({
  documentType: z.enum([
    "CV",
    "RESUME",
    "TRANSCRIPT",
    "ENROLLMENT_CERTIFICATE",
    "RECOMMENDATION_LETTER",
    "MOTIVATION_LETTER",
    "LANGUAGE_CERTIFICATE",
    "PORTFOLIO",
    "RESEARCH_PROPOSAL",
    "PASSPORT_COPY",
    "OTHER",
  ]),
  required: z.boolean().default(true),
  description: z.string().trim().max(400).optional().nullable(),
  sortOrder: z.number().int().min(0).max(99).default(0),
});

export const opportunityBenefitSchema = z.object({
  type: z.enum([
    "TUITION",
    "ACCOMMODATION",
    "STIPEND",
    "SALARY",
    "INSURANCE",
    "TRAVEL",
    "REGISTRATION_FEE",
    "MEALS",
    "TRANSPORT",
    "VISA_SUPPORT",
    "HOUSING_SUPPORT",
    "OTHER",
  ]),
  amountMinor: z.number().int().min(0).max(1_000_000_000).optional().nullable(),
  currency: z.string().trim().length(3).optional().nullable(),
  period: z
    .enum(["HOUR", "DAY", "WEEK", "MONTH", "YEAR", "TOTAL"])
    .optional()
    .nullable(),
  description: z.string().trim().max(400).optional().nullable(),
  confidence: z
    .enum(["CONFIRMED", "POSSIBLE", "NOT_SPECIFIED"])
    .default("NOT_SPECIFIED"),
  sortOrder: z.number().int().min(0).max(99).default(0),
});

export const opportunityLanguageRequirementSchema = z.object({
  language: z.string().trim().min(2).max(80),
  level: z.enum(["BASIC", "INTERMEDIATE", "ADVANCED", "FLUENT", "NATIVE"]),
  certificateType: z.string().trim().max(80).optional().nullable(),
  required: z.boolean().default(true),
});

export const opportunityAuthoringSchema = z.object({
  draft: opportunityDraftSchema,
  scholarship: scholarshipDetailSchema.optional().nullable(),
  job: jobDetailSchema.optional().nullable(),
  eligibilityRules: z.array(eligibilityRuleSchema).max(40).optional(),
  benefits: z.array(opportunityBenefitSchema).max(30).optional(),
  requirements: z.array(applicationRequirementSchema).max(20).optional(),
  questions: z.array(applicationQuestionSchema).max(30).optional(),
  languageRequirements: z
    .array(opportunityLanguageRequirementSchema)
    .max(20)
    .optional(),
});

export const saveOpportunitySchema = z.object({
  remindBeforeDays: z
    .union([z.literal(14), z.literal(7), z.literal(3), z.literal(1)])
    .optional()
    .nullable(),
});

export const applicationDraftSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().cuid(),
        answerText: z.string().trim().max(5000).optional().nullable(),
        answerStructured: z.unknown().optional().nullable(),
      }),
    )
    .max(50)
    .optional(),
  documentIds: z.array(z.string().cuid()).max(20).optional(),
});

export const submitApplicationSchema = z.object({
  consentAccepted: z.literal(true, {
    errorMap: () => ({
      message: "Confirm what you are sharing before submitting.",
    }),
  }),
});

export const applicationStatusChangeSchema = z.object({
  toStatus: z.enum([
    "UNDER_REVIEW",
    "MORE_INFORMATION_REQUIRED",
    "SHORTLISTED",
    "INTERVIEW",
    "OFFERED",
    "REJECTED",
    "CANCELLED",
  ]),
  applicantVisibleNote: z.string().trim().max(2000).optional().nullable(),
  internalNote: z.string().trim().max(2000).optional().nullable(),
  informationDueAt: z.coerce.date().optional().nullable(),
  offerResponseDueAt: z.coerce.date().optional().nullable(),
});

export const opportunityReportSchema = z.object({
  reason: z.enum(["SPAM", "HARASSMENT", "SCAM", "INAPPROPRIATE", "OTHER"]),
  details: z.string().trim().max(1000).optional().nullable(),
});

export const opportunityDocumentSchema = z.object({
  mediaId: z.string().cuid(),
  category: applicationRequirementSchema.shape.documentType,
  displayName: z.string().trim().min(2).max(200),
  institution: z.string().trim().max(200).optional().nullable(),
  issuedOn: z.coerce.date().optional().nullable(),
  expiresOn: z.coerce.date().optional().nullable(),
  language: z.string().trim().max(80).optional().nullable(),
});

export const opportunityProfileSchema = z.object({
  preferredTypes: z.array(opportunityTypeSchema).max(12).optional(),
  preferredCityIds: z.array(z.string().cuid()).max(10).optional(),
  remotePreference: z
    .enum(["ON_SITE", "REMOTE", "HYBRID", "CAMPUS", "UNSPECIFIED"])
    .optional()
    .nullable(),
  experienceLevel: jobDetailSchema.innerType().shape.experienceLevel.optional(),
  availabilityFrom: z.coerce.date().optional().nullable(),
  professionalInterests: z.array(z.string().trim().max(60)).max(20).optional(),
  skills: z.array(z.string().trim().max(60)).max(30).optional(),
  workAuthorizationNote: z.string().trim().max(500).optional().nullable(),
  portfolioUrl: externalUrl.optional().nullable(),
  professionalProfileUrl: externalUrl.optional().nullable(),
  coverLetterTemplate: z.string().trim().max(10_000).optional().nullable(),
  recommendationsEnabled: z.boolean().optional(),
  deadlineReminderDays: z
    .array(z.union([z.literal(14), z.literal(7), z.literal(3), z.literal(1)]))
    .max(4)
    .optional(),
});

export const opportunityInterviewSchema = z
  .object({
    format: z.enum(["VIDEO", "PHONE", "IN_PERSON", "OTHER"]),
    scheduledAt: z.coerce.date(),
    timezone: z.string().trim().min(2).max(64),
    locationLabel: z.string().trim().max(240).optional().nullable(),
    meetingUrl: externalUrl.optional().nullable(),
    preparationNote: z.string().trim().max(2000).optional().nullable(),
  })
  .superRefine((value, context) => {
    if (value.format === "VIDEO" && !value.meetingUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meetingUrl"],
        message: "Add the secure interview meeting link.",
      });
    }
    if (value.format === "IN_PERSON" && !value.locationLabel) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["locationLabel"],
        message: "Add the interview location.",
      });
    }
  });

export const opportunityInterviewResponseSchema = z.object({
  response: z.enum(["ACCEPTED", "DECLINED"]),
});
