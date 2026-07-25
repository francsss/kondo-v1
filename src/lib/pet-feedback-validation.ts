import { z } from "zod";

export const petFeedbackCategories = [
  "BUG",
  "SUGGESTION",
  "IDEA",
  "EXPERIENCE",
  "OTHER",
] as const;

export const petFeedbackStatuses = ["NEW", "IN_PROGRESS", "RESOLVED"] as const;

export const petFeedbackPageAreas = [
  "home",
  "communities",
  "explore",
  "marketplace",
  "student_hub",
] as const;

const safePagePath = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .refine(
    (value) =>
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !value.includes("?") &&
      !value.includes("#") &&
      !value.includes("\\") &&
      !/[\u0000-\u001f\u007f]/.test(value),
    "Use a valid Kondo page path.",
  );

export const petFeedbackSubmissionSchema = z.object({
  category: z.enum(petFeedbackCategories),
  message: z.string().trim().min(4).max(2000),
  pagePath: safePagePath,
  submittedAfterMs: z
    .number()
    .int()
    .min(0)
    .max(60 * 60 * 1000)
    .optional(),
});

export const petFeedbackStatusSchema = z.object({
  status: z.enum(petFeedbackStatuses),
  expectedVersion: z.number().int().positive(),
});

export const petFeedbackNoteSchema = z.object({
  body: z.string().trim().min(2).max(2000),
});
