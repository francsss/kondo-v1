import { z } from "zod";

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).nullable().optional();
const optionalUrl = z
  .union([z.string().trim().url().max(500), z.literal(""), z.null()])
  .optional()
  .transform((value) => value || null);
const optionalDate = z
  .union([z.string().date(), z.literal(""), z.null()])
  .optional()
  .transform((value) => value || null);
const stringList = (maximumItems = 30) =>
  z.array(z.string().trim().min(1).max(160)).max(maximumItems).default([]);

const scholarshipShape = {
  title: z.string().trim().min(3).max(180),
  provider: z.string().trim().min(2).max(160),
  countryId: z.string().cuid().nullable().optional(),
  universityIds: z.array(z.string().cuid()).max(40).default([]),
  city: optionalText(120),
  studyLevels: z
    .array(
      z.enum([
        "LANGUAGE",
        "BACHELORS",
        "MASTERS",
        "DOCTORATE",
        "EXCHANGE",
        "OTHER",
      ]),
    )
    .min(1)
    .max(6),
  fields: stringList(),
  eligibleNationalities: stringList(),
  fundingType: z.enum(["FULL", "PARTIAL"]),
  status: z.enum(["OPEN", "OPENING_SOON", "CLOSED"]),
  opensAt: optionalDate,
  closesAt: optionalDate,
  applicationUrl: z.string().trim().url().max(500),
  description: z.string().trim().min(20).max(8_000),
  eligibilityCriteria: stringList(50),
  requiredDocuments: stringList(50),
  coverage: stringList(30),
  applicationSteps: stringList(30),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  markVerified: z.boolean().default(false),
};

export const scholarshipInputSchema = z
  .object(scholarshipShape)
  .refine(
    (value) =>
      !value.opensAt || !value.closesAt || value.opensAt <= value.closesAt,
    {
      message: "The closing date must be after the opening date.",
      path: ["closesAt"],
    },
  );

export const scholarshipUpdateSchema = z
  .object(scholarshipShape)
  .partial()
  .refine(
    (value) =>
      !value.opensAt || !value.closesAt || value.opensAt <= value.closesAt,
    {
      message: "The closing date must be after the opening date.",
      path: ["closesAt"],
    },
  );

export const scholarshipAgentInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  company: optionalText(160),
  logoUrl: optionalUrl,
  countryId: z.string().cuid().nullable().optional(),
  languages: stringList(20),
  specialties: stringList(30),
  services: stringList(40),
  feeDetails: optionalText(500),
  whatsapp: optionalText(80),
  wechat: optionalText(80),
  email: z
    .union([z.string().trim().email().max(254), z.literal(""), z.null()])
    .optional()
    .transform((value) => value || null),
  website: optionalUrl,
  availability: z.enum(["AVAILABLE", "LIMITED", "UNAVAILABLE"]),
  averageRating: z.number().min(0).max(5).nullable().optional(),
  biography: z.string().trim().max(5_000).default(""),
  verified: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const scholarshipAgentUpdateSchema =
  scholarshipAgentInputSchema.partial();

export const scholarshipAgentReportSchema = z.object({
  reason: z.enum(["SPAM", "HARASSMENT", "SCAM", "INAPPROPRIATE", "OTHER"]),
  details: z.string().trim().min(10).max(1_000),
});

export type ScholarshipInput = z.infer<typeof scholarshipInputSchema>;
export type ScholarshipAgentInput = z.infer<typeof scholarshipAgentInputSchema>;
