import { z } from "zod";
import {
  deriveUniversityPeriodDuration,
  validateUniversityPeriodDrafts,
} from "@/lib/university-periods";

export const scheduleDaySchema = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

export const weekPatternSchema = z.enum(["ALL", "ODD", "EVEN", "CUSTOM"]);
const timeSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    "Use a valid 24-hour time in HH:MM format.",
  );
const optionalTimeSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  timeSchema.nullable(),
);
const optionalPeriodSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.coerce.number().int().positive().max(40).nullable(),
);

export const extractedCourseSchema = z
  .object({
    courseName: z.string().trim().min(1).max(200),
    teacher: z.string().trim().max(160).nullable(),
    dayOfWeek: scheduleDaySchema,
    specificDate: z.string().date().nullable(),
    startPeriod: z.number().int().positive().max(40).nullable(),
    endPeriod: z.number().int().positive().max(40).nullable(),
    startTime: timeSchema.nullable(),
    endTime: timeSchema.nullable(),
    room: z.string().trim().max(120).nullable(),
    building: z.string().trim().max(160).nullable(),
    campus: z.string().trim().max(160).nullable(),
    startWeek: z.number().int().positive().max(60).nullable(),
    endWeek: z.number().int().positive().max(60).nullable(),
    weekPattern: weekPatternSchema,
    weeks: z.array(z.number().int().positive().max(60)).max(60),
    language: z.string().trim().max(80).nullable(),
    notes: z.string().trim().max(2_000).nullable(),
    confidence: z.number().min(0).max(1),
    uncertainFields: z.array(z.string().trim().max(80)).max(20),
  })
  .superRefine((course, context) => {
    if (!course.startTime && !course.startPeriod) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A start time or period is required.",
      });
    }
    if (!course.endTime && !course.endPeriod) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An end time or period is required.",
      });
    }
    if (course.weekPattern === "CUSTOM" && course.weeks.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom week patterns require at least one week.",
      });
    }
  });

export const scheduleExtractionSchema = z.object({
  title: z.string().trim().max(160).nullable(),
  courses: z.array(extractedCourseSchema).max(150),
  warnings: z.array(z.string().trim().max(300)).max(50),
});

export type ExtractedSchedule = z.infer<typeof scheduleExtractionSchema>;

export const scheduleCourseInputSchema = z
  .object({
    courseName: z.string().trim().min(1).max(200),
    teacher: z.string().trim().max(160).nullable().optional(),
    dayOfWeek: z.coerce.number().int().min(1).max(7),
    specificDate: z.string().date().nullable().optional(),
    startPeriod: optionalPeriodSchema,
    endPeriod: optionalPeriodSchema,
    startTime: optionalTimeSchema,
    endTime: optionalTimeSchema,
    room: z.string().trim().max(120).nullable().optional(),
    building: z.string().trim().max(160).nullable().optional(),
    campusLabel: z.string().trim().max(160).nullable().optional(),
    startWeek: z.coerce.number().int().positive().max(60).nullable().optional(),
    endWeek: z.coerce.number().int().positive().max(60).nullable().optional(),
    weekPattern: weekPatternSchema.default("ALL"),
    weeks: z
      .array(z.coerce.number().int().positive().max(60))
      .max(60)
      .default([]),
    language: z.string().trim().max(80).nullable().optional(),
    notes: z.string().trim().max(2_000).nullable().optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default("#22A06B"),
    isOptional: z.boolean().default(false),
    confidence: z.number().min(0).max(1).nullable().optional(),
    source: z.enum(["IMPORT", "MANUAL"]).default("MANUAL"),
  })
  .superRefine((course, context) => {
    const hasStartTime = Boolean(course.startTime);
    const hasEndTime = Boolean(course.endTime);
    const hasStartPeriod = course.startPeriod !== null;
    const hasEndPeriod = course.endPeriod !== null;

    if (hasStartTime !== hasEndTime) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide both the start and end time, or leave both empty.",
        path: [hasStartTime ? "endTime" : "startTime"],
      });
    }
    if (hasStartPeriod !== hasEndPeriod) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Provide both the start and end period number, or leave both empty.",
        path: [hasStartPeriod ? "endPeriod" : "startPeriod"],
      });
    }
    if (!hasStartTime && !hasStartPeriod) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "A complete clock-time range or a complete period-number range is required.",
        path: ["startTime"],
      });
    }
    if (
      course.startTime &&
      course.endTime &&
      course.startTime >= course.endTime
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The end time must be after the start time.",
        path: ["endTime"],
      });
    }
    if (
      course.startPeriod !== null &&
      course.endPeriod !== null &&
      course.startPeriod > course.endPeriod
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The end period must be after the start period.",
        path: ["endPeriod"],
      });
    }
    if (
      course.startWeek !== null &&
      course.startWeek !== undefined &&
      course.endWeek !== null &&
      course.endWeek !== undefined &&
      course.startWeek > course.endWeek
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The last week must not be before the first week.",
        path: ["endWeek"],
      });
    }
    if (course.weekPattern === "CUSTOM" && course.weeks.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom week patterns require at least one week number.",
        path: ["weeks"],
      });
    }
  });

export const scheduleImportCreateSchema = z.object({
  universityId: z.string().cuid(),
  campusId: z.string().cuid().nullable().optional(),
  academicTermId: z.string().cuid().nullable().optional(),
  mediaIds: z.array(z.string().cuid()).min(1).max(5),
  retainSource: z.boolean().default(false),
});

export const scheduleImportConfirmSchema = z.object({
  title: z.string().trim().min(2).max(160),
  courses: z.array(scheduleCourseInputSchema).min(1).max(150),
});

export const scheduleCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  universityId: z.string().cuid().nullable().optional(),
  campusId: z.string().cuid().nullable().optional(),
  academicTermId: z.string().cuid().nullable().optional(),
  timezone: z.string().trim().min(3).max(80).default("Asia/Shanghai"),
});

const academicTaskBaseSchema = z.object({
  scheduleId: z.string().cuid().nullable().optional(),
  courseId: z.string().cuid().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2_000).nullable().optional(),
  kind: z
    .enum(["ASSIGNMENT", "PROJECT", "EXAM", "REMINDER", "EVENT"])
    .default("ASSIGNMENT"),
  status: z
    .enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    .default("PENDING"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  dueAt: z.string().datetime().nullable().optional(),
  reminderAt: z.string().datetime().nullable().optional(),
});

function validateTaskDates(
  task: { reminderAt?: string | null; dueAt?: string | null },
  context: z.RefinementCtx,
) {
  if (
    task.reminderAt &&
    task.dueAt &&
    new Date(task.reminderAt) > new Date(task.dueAt)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "The reminder must be scheduled before the due date.",
      path: ["reminderAt"],
    });
  }
}

export const academicTaskInputSchema =
  academicTaskBaseSchema.superRefine(validateTaskDates);

export const academicTaskUpdateSchema = academicTaskBaseSchema
  .partial()
  .superRefine(validateTaskDates);

export const campusSchema = z.object({
  name: z.string().trim().min(2).max(160),
  address: z.string().trim().max(300).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const academicTermSchema = z
  .object({
    campusId: z.string().cuid().nullable().optional(),
    name: z.string().trim().min(2).max(160),
    startsOn: z.string().date(),
    endsOn: z.string().date(),
    firstWeekStartsOn: z.string().date(),
    totalWeeks: z.coerce.number().int().min(1).max(60),
    isActive: z.boolean().default(true),
  })
  .refine((term) => term.startsOn <= term.endsOn, {
    message: "The term end date must be after its start date.",
    path: ["endsOn"],
  });

export const classPeriodSchema = z
  .object({
    periodNumber: z.coerce.number().int().positive().max(40),
    label: z.string().trim().min(1).max(80),
    startTime: timeSchema,
    endTime: timeSchema,
    displayOrder: z.coerce.number().int().min(0).max(100),
    part: z.enum(["MORNING", "AFTERNOON", "EVENING"]).nullable().optional(),
    isBreak: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .refine((period) => period.startTime < period.endTime, {
    message: "The period end time must be after its start time.",
    path: ["endTime"],
  });

export const periodConfigurationSchema = z
  .object({
    campusId: z.string().cuid().nullable().optional(),
    name: z.string().trim().min(2).max(160),
    timezone: z.string().trim().min(3).max(80),
    primaryLanguage: z.string().trim().min(2).max(30),
    isActive: z.boolean().default(true),
    isDefault: z.boolean().default(false),
    periods: z.array(classPeriodSchema).min(1).max(40),
  })
  .superRefine((configuration, context) => {
    const issues = validateUniversityPeriodDrafts(
      configuration.periods.map((period) => ({
        periodNumber: period.periodNumber,
        startTime: period.startTime,
        durationMinutes:
          deriveUniversityPeriodDuration(period.startTime, period.endTime) ?? 0,
      })),
    );
    for (const issue of issues) {
      const index = issue.indexes.at(-1) ?? 0;
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: issue.message,
        path: [
          "periods",
          index,
          issue.code === "DUPLICATE_PERIOD"
            ? "periodNumber"
            : issue.code === "INVALID_DURATION"
              ? "endTime"
              : "startTime",
        ],
      });
    }
  });

export const SCHEDULE_EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "courses", "warnings"],
  properties: {
    title: { type: ["string", "null"] },
    warnings: { type: "array", items: { type: "string" } },
    courses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "courseName",
          "teacher",
          "dayOfWeek",
          "startPeriod",
          "endPeriod",
          "startTime",
          "endTime",
          "room",
          "confidence",
          "uncertainFields",
        ],
        properties: {
          courseName: { type: "string" },
          teacher: { type: ["string", "null"] },
          dayOfWeek: { enum: scheduleDaySchema.options },
          startPeriod: { type: ["integer", "null"] },
          endPeriod: { type: ["integer", "null"] },
          startTime: { type: ["string", "null"] },
          endTime: { type: ["string", "null"] },
          room: { type: ["string", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          uncertainFields: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;
