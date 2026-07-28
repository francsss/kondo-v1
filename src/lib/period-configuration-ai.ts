import type { MediaAsset } from "@prisma/client";
import { z } from "zod";
import {
  DocumentExtractionError,
  extractDocumentText,
} from "@/lib/document-ocr";
import { logServerError, logServerEvent } from "@/lib/logger";
import { DEEPSEEK_TIMETABLE_MODEL } from "@/lib/schedule-ai";
import { getObjectStorageForProvider } from "@/lib/storage";
import {
  deriveUniversityPeriodDuration,
  universityTimeToMinutes,
} from "@/lib/university-periods";

type PeriodStructureFile = Pick<
  MediaAsset,
  "objectKey" | "storageProvider" | "detectedMime" | "originalFileName"
>;

const nullableTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable();
const uncertainFieldSchema = z.enum(["periodNumber", "startTime", "endTime"]);
const periodStructureResponseSchema = z.object({
  periods: z
    .array(
      z.object({
        periodNumber: z.number().int().min(1).max(40).nullable(),
        startTime: nullableTimeSchema,
        endTime: nullableTimeSchema,
        confidence: z.number().min(0).max(1),
        uncertainFields: z.array(uncertainFieldSchema),
      }),
    )
    .min(1)
    .max(40),
  warnings: z.array(z.string().trim().min(1).max(300)).max(40),
});

export type ExtractedUniversityPeriod = {
  periodNumber: number | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  confidence: number;
  uncertainFields: Array<z.infer<typeof uncertainFieldSchema>>;
};

export type PeriodStructureAnalysis = {
  periods: ExtractedUniversityPeriod[];
  warnings: string[];
  diagnostics: {
    method: string;
    pageCount: number;
    characterCount: number;
    confidence: number | null;
    model: string;
  };
};

export class PeriodStructureAnalysisError extends Error {
  constructor(
    public readonly code: string,
    public readonly userMessage: string,
    public readonly status: number,
    public readonly retryable: boolean,
  ) {
    super(userMessage);
    this.name = "PeriodStructureAnalysisError";
  }
}

function normalizedTime(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/[：.]/g, ":").replace(/\s+/g, "");
  const match = /^(\d{1,2}):(\d{2})$/.exec(normalized);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizedPeriodNumber(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.match(/\d{1,2}/);
  return match ? Number(match[0]) : null;
}

export function normalizePeriodStructureCandidate(candidate: unknown) {
  const source =
    candidate && typeof candidate === "object"
      ? (candidate as Record<string, unknown>)
      : {};
  const sourcePeriods = Array.isArray(source.periods) ? source.periods : [];
  const periods = sourcePeriods.map((item) => {
    const period =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const periodNumber = normalizedPeriodNumber(period.periodNumber);
    const startTime = normalizedTime(period.startTime);
    const endTime = normalizedTime(period.endTime);
    const suppliedUncertainty = Array.isArray(period.uncertainFields)
      ? period.uncertainFields.filter(
          (field) => uncertainFieldSchema.safeParse(field).success,
        )
      : [];
    const confidence =
      typeof period.confidence === "number" &&
      period.confidence >= 0 &&
      period.confidence <= 1
        ? period.confidence
        : 0.5;
    const uncertainFields = new Set(suppliedUncertainty);
    if (periodNumber === null) uncertainFields.add("periodNumber");
    if (startTime === null) uncertainFields.add("startTime");
    if (endTime === null) uncertainFields.add("endTime");
    if (confidence < 0.78 && uncertainFields.size === 0) {
      uncertainFields.add("startTime");
      uncertainFields.add("endTime");
    }
    return {
      periodNumber,
      startTime,
      endTime,
      confidence,
      uncertainFields: [...uncertainFields],
    };
  });
  const warnings = Array.isArray(source.warnings)
    ? source.warnings.filter(
        (warning): warning is string =>
          typeof warning === "string" && Boolean(warning.trim()),
      )
    : [];
  return { periods, warnings };
}

function responseContent(payload: Record<string, unknown>) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0];
  const message =
    first && typeof first === "object"
      ? (first as Record<string, unknown>).message
      : null;
  const content =
    message && typeof message === "object"
      ? (message as Record<string, unknown>).content
      : null;
  if (typeof content !== "string" || !content.trim()) {
    throw new PeriodStructureAnalysisError(
      "AI_EMPTY_RESPONSE",
      "DeepSeek returned no period structure. Try another official timetable page.",
      502,
      true,
    );
  }
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function reviewPeriodStructure(
  input: z.infer<typeof periodStructureResponseSchema>,
) {
  const warnings = new Set(input.warnings);
  const periods: ExtractedUniversityPeriod[] = input.periods.map((period) => {
    const uncertainFields = new Set(period.uncertainFields);
    const durationMinutes =
      period.startTime && period.endTime
        ? deriveUniversityPeriodDuration(period.startTime, period.endTime)
        : null;
    if (durationMinutes === null || durationMinutes > 240) {
      uncertainFields.add("startTime");
      uncertainFields.add("endTime");
      warnings.add(
        `Period ${period.periodNumber ?? "with an unknown number"} has an invalid or missing time range.`,
      );
    }
    return {
      ...period,
      durationMinutes:
        durationMinutes !== null && durationMinutes <= 240
          ? durationMinutes
          : null,
      uncertainFields: [...uncertainFields],
    };
  });

  for (let left = 0; left < periods.length; left += 1) {
    for (let right = left + 1; right < periods.length; right += 1) {
      const first = periods[left]!;
      const second = periods[right]!;
      if (
        first.periodNumber !== null &&
        first.periodNumber === second.periodNumber
      ) {
        first.uncertainFields = [
          ...new Set([...first.uncertainFields, "periodNumber" as const]),
        ];
        second.uncertainFields = [
          ...new Set([...second.uncertainFields, "periodNumber" as const]),
        ];
        warnings.add(
          `Period ${first.periodNumber} was detected more than once.`,
        );
      }
      const firstStart = first.startTime
        ? universityTimeToMinutes(first.startTime)
        : null;
      const firstEnd = first.endTime
        ? universityTimeToMinutes(first.endTime)
        : null;
      const secondStart = second.startTime
        ? universityTimeToMinutes(second.startTime)
        : null;
      const secondEnd = second.endTime
        ? universityTimeToMinutes(second.endTime)
        : null;
      if (
        firstStart !== null &&
        firstEnd !== null &&
        secondStart !== null &&
        secondEnd !== null &&
        firstStart < secondEnd &&
        secondStart < firstEnd
      ) {
        first.uncertainFields = [
          ...new Set([
            ...first.uncertainFields,
            "startTime" as const,
            "endTime" as const,
          ]),
        ];
        second.uncertainFields = [
          ...new Set([
            ...second.uncertainFields,
            "startTime" as const,
            "endTime" as const,
          ]),
        ];
        warnings.add(
          `Periods ${first.periodNumber ?? left + 1} and ${second.periodNumber ?? right + 1} overlap and require review.`,
        );
      }
    }
  }

  return { periods, warnings: [...warnings] };
}

export async function analyzeUniversityPeriodStructure(input: {
  file: PeriodStructureFile;
  university: string;
  campus: string | null;
}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new PeriodStructureAnalysisError(
      "AI_NOT_CONFIGURED",
      "DeepSeek period extraction is not configured.",
      503,
      false,
    );
  }

  let bytes: Uint8Array;
  try {
    bytes = await getObjectStorageForProvider(input.file.storageProvider).read(
      input.file.objectKey,
    );
  } catch (error) {
    logServerError(
      "admin.student-hub.period-import.storage-read.failed",
      error,
      {
        provider: input.file.storageProvider,
      },
    );
    throw new PeriodStructureAnalysisError(
      "STORAGE_READ_FAILED",
      "The official timetable could not be read from media storage.",
      502,
      true,
    );
  }

  let extracted: Awaited<ReturnType<typeof extractDocumentText>>;
  try {
    extracted = await extractDocumentText(
      bytes,
      input.file.detectedMime ?? "application/octet-stream",
    );
  } catch (error) {
    if (error instanceof DocumentExtractionError) {
      throw new PeriodStructureAnalysisError(
        "DOCUMENT_EXTRACTION_FAILED",
        error.message,
        422,
        error.retryable,
      );
    }
    throw error;
  }
  logServerEvent("admin.student-hub.period-import.text-extracted", {
    university: input.university,
    campus: input.campus,
    method: extracted.method,
    pageCount: extracted.pageCount,
    characterCount: extracted.characterCount,
    confidence: extracted.confidence,
  });

  const systemPrompt = [
    "You extract the official numbered class-period structure from university timetable text.",
    "Return exactly one JSON object and no markdown.",
    "Extract only numbered academic periods and their printed start and end clock times.",
    "Do not extract courses, teachers, classrooms, weekdays, dates, breaks, lunch, or decorative labels.",
    "Read Chinese, English, and mixed Chinese-English text.",
    "Never invent a missing period number or time. Use null and list the field in uncertainFields.",
    "Use 24-hour HH:MM times.",
    "confidence must be between 0 and 1.",
    'Schema: {"periods":[{"periodNumber":number|null,"startTime":"HH:MM"|null,"endTime":"HH:MM"|null,"confidence":number,"uncertainFields":["periodNumber"|"startTime"|"endTime"]}],"warnings":[string]}',
  ].join("\n");
  const userPrompt = [
    `University: ${input.university}`,
    `Campus: ${input.campus ?? "all campuses"}`,
    `Document: ${input.file.originalFileName}`,
    "Extract the official period structure from this OCR/PDF text:",
    extracted.text,
  ].join("\n\n");
  const timeout = Math.min(
    120_000,
    Math.max(20_000, Number(process.env.SCHEDULE_AI_TIMEOUT_MS) || 75_000),
  );

  const controller = new AbortController();
  const abort = setTimeout(() => controller.abort(), timeout);
  try {
    logServerEvent("admin.student-hub.period-import.deepseek.started", {
      model: DEEPSEEK_TIMETABLE_MODEL,
      university: input.university,
      campus: input.campus,
    });
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEEPSEEK_TIMETABLE_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        temperature: 0,
        max_tokens: 4_096,
        stream: false,
      }),
      signal: controller.signal,
    });
    const responseBody = await response.text();
    const payload = JSON.parse(responseBody) as Record<string, unknown>;
    if (!response.ok) {
      const providerError =
        payload.error && typeof payload.error === "object"
          ? (payload.error as Record<string, unknown>)
          : {};
      const providerCode =
        typeof providerError.code === "string" ? providerError.code : null;
      logServerEvent("admin.student-hub.period-import.deepseek.rejected", {
        status: response.status,
        providerCode,
      });
      throw new PeriodStructureAnalysisError(
        response.status === 401 || response.status === 403
          ? "AI_AUTHENTICATION_FAILED"
          : response.status === 429
            ? "AI_RATE_LIMITED"
            : "AI_PROVIDER_ERROR",
        response.status === 401 || response.status === 403
          ? "DeepSeek authentication failed. Check the production API key."
          : response.status === 429
            ? "DeepSeek is rate-limiting period extraction. Try again shortly."
            : "DeepSeek could not analyze this official timetable.",
        response.status === 429 ? 429 : 502,
        response.status !== 401 && response.status !== 403,
      );
    }
    const candidate = JSON.parse(responseContent(payload)) as unknown;
    const parsed = periodStructureResponseSchema.safeParse(
      normalizePeriodStructureCandidate(candidate),
    );
    if (!parsed.success) {
      logServerEvent("admin.student-hub.period-import.validation.failed", {
        issueCount: parsed.error.issues.length,
        firstIssue: parsed.error.issues[0]?.path.join(".") ?? "unknown",
      });
      throw new PeriodStructureAnalysisError(
        "AI_INVALID_RESPONSE",
        "DeepSeek returned a period structure that could not be reviewed safely.",
        502,
        true,
      );
    }
    const reviewed = reviewPeriodStructure(parsed.data);
    logServerEvent("admin.student-hub.period-import.completed", {
      model: DEEPSEEK_TIMETABLE_MODEL,
      periodCount: reviewed.periods.length,
      uncertainPeriodCount: reviewed.periods.filter(
        (period) => period.uncertainFields.length > 0,
      ).length,
    });
    return {
      ...reviewed,
      diagnostics: {
        method: extracted.method,
        pageCount: extracted.pageCount,
        characterCount: extracted.characterCount,
        confidence: extracted.confidence,
        model: DEEPSEEK_TIMETABLE_MODEL,
      },
    } satisfies PeriodStructureAnalysis;
  } catch (error) {
    if (error instanceof PeriodStructureAnalysisError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new PeriodStructureAnalysisError(
        "AI_TIMEOUT",
        "DeepSeek took too long to analyze the official timetable.",
        504,
        true,
      );
    }
    logServerError("admin.student-hub.period-import.failed", error);
    throw new PeriodStructureAnalysisError(
      "AI_INVALID_RESPONSE",
      "The official timetable could not be converted into a period structure.",
      502,
      true,
    );
  } finally {
    clearTimeout(abort);
  }
}
