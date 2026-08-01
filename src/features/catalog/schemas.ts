import { z } from "zod";
import {
  isHttpWebsiteUrl,
  normalizeOptionalWebsiteUrl,
} from "@/lib/website-url";

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value?.trim() || null);

export const catalogResourceSchema = z
  .object({
    title: z.string().trim().max(180).default(""),
    shortDescription: z.string().trim().max(400).default(""),
    description: z.string().trim().max(10_000).default(""),
    category: z.string().trim().max(100).default("General"),
    cityId: z.string().cuid().optional().nullable(),
    priceType: z
      .enum(["FREE", "FIXED", "STARTING_AT", "CONTACT"])
      .default("CONTACT"),
    priceMinor: z
      .number()
      .int()
      .min(0)
      .max(1_000_000_000)
      .optional()
      .nullable(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/)
      .default("CNY"),
    availabilityLabel: nullableText(180),
    locationLabel: nullableText(200),
    deliveryMode: nullableText(160),
    contactMethod: z
      .enum(["KONDO_MESSAGE", "PUBLIC_CONTACT", "EXTERNAL_URL"])
      .default("KONDO_MESSAGE"),
    externalUrl: z
      .preprocess(normalizeOptionalWebsiteUrl, z.string().max(500).optional())
      .refine((value) => !value || isHttpWebsiteUrl(value), {
        message: "Use a safe http or https address.",
      })
      .optional()
      .nullable(),
    version: z.number().int().positive().optional(),
  })
  .superRefine((value, context) => {
    const priced =
      value.priceType === "FIXED" || value.priceType === "STARTING_AT";
    if (priced && value.priceMinor === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priceMinor"],
        message: "Add the real price for this pricing option.",
      });
    }
    if (!priced && value.priceMinor != null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priceMinor"],
        message: "This pricing option does not use an amount.",
      });
    }
    if (value.contactMethod === "EXTERNAL_URL" && !value.externalUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["externalUrl"],
        message: "Add the official external address.",
      });
    }
  });

export const catalogTransitionSchema = z.object({
  action: z.enum([
    "SUBMIT",
    "PUBLISH",
    "PAUSE",
    "RESUME",
    "OUT_OF_STOCK",
    "UNAVAILABLE",
    "ARCHIVE",
  ]),
});

export const catalogInquirySchema = z.object({
  message: z.string().trim().min(1).max(2_000),
  topic: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .default("Product or service inquiry"),
  clientMessageId: z.string().uuid().optional(),
});

export const catalogReportSchema = z.object({
  reason: z.enum([
    "SCAM",
    "MISLEADING_PRICE",
    "COUNTERFEIT_OR_PROHIBITED_PRODUCT",
    "MISLEADING_SERVICE_CLAIM",
    "UNSAFE_EXTERNAL_LINK",
    "UNAUTHORIZED_FEE",
    "FALSE_GUARANTEE",
    "IMPERSONATION",
    "STOLEN_MEDIA",
    "OTHER",
  ]),
  details: z.string().trim().max(1_000).optional(),
});

export type CatalogResourceInput = z.infer<typeof catalogResourceSchema>;
