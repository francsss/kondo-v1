import type { MediaAsset } from "@prisma/client";
import { ZodError } from "zod";
import {
  SCHEDULE_EXTRACTION_JSON_SCHEMA,
  scheduleExtractionSchema,
  type ExtractedSchedule,
} from "@/features/student-hub/schemas";
import {
  DocumentExtractionError,
  extractDocumentText,
} from "@/lib/document-ocr";
import { logServerError, logServerEvent } from "@/lib/logger";
import {
  assessExtractedDocument,
  type DocumentQualityDiagnostic,
} from "@/lib/schedule-validation";
import { normalizeScheduleExtractionCandidate } from "@/lib/schedule-extraction-normalization";
import { describeTimetableValidation } from "@/lib/schedule-validation-errors";
import { getObjectStorageForProvider } from "@/lib/storage";

type ScheduleFile = Pick<
  MediaAsset,
  "objectKey" | "storageProvider" | "detectedMime" | "originalFileName"
>;

type PeriodContext = {
  university: string;
  campus?: string | null;
  term?: string | null;
  timezone: string;
  periods: Array<{
    periodNumber: number;
    label: string;
    startTime: string;
    endTime: string;
  }>;
};

const DEEPSEEK_TIMETABLE_MODEL = "deepseek-v4-flash";

export type ScheduleAnalysis = {
  extraction: ExtractedSchedule;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  diagnostics: DocumentQualityDiagnostic[];
};

export interface ScheduleAnalysisProvider {
  analyze(
    files: ScheduleFile[],
    context: PeriodContext,
    onStage?: (
      stage: "TEXT_EXTRACTION" | "STRUCTURED_EXTRACTION",
    ) => Promise<void> | void,
  ): Promise<ScheduleAnalysis>;
}

export type ScheduleAnalysisErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_AUTHENTICATION_FAILED"
  | "AI_QUOTA_EXCEEDED"
  | "AI_RATE_LIMITED"
  | "AI_TIMEOUT"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_DOCUMENT_REJECTED"
  | "AI_INVALID_RESPONSE"
  | "DOCUMENT_TOO_BLURRY"
  | "NO_TIMETABLE_DETECTED"
  | "NO_COURSE_NAMES"
  | "TIMETABLE_RECONSTRUCTION_FAILED"
  | "PERIOD_CONFIG_MISSING"
  | "DOCUMENT_UNSUPPORTED"
  | "DOCUMENT_PAGE_LIMIT"
  | "DOCUMENT_TEXT_EXTRACTION_FAILED"
  | "STORAGE_READ_FAILED";

export class ScheduleAnalysisError extends Error {
  constructor(
    public readonly code: ScheduleAnalysisErrorCode,
    public readonly userMessage: string,
    public readonly status: number,
    public readonly retryable: boolean,
  ) {
    super(userMessage);
    this.name = "ScheduleAnalysisError";
  }
}

function providerError(
  status: number,
  payload: Record<string, unknown> | null,
) {
  const details =
    payload?.error && typeof payload.error === "object"
      ? (payload.error as Record<string, unknown>)
      : {};
  const providerCode =
    typeof details.code === "string" ? details.code : undefined;
  const providerType =
    typeof details.type === "string" ? details.type : undefined;

  if (
    status === 402 ||
    providerCode === "insufficient_balance" ||
    providerCode === "insufficient_quota"
  ) {
    return new ScheduleAnalysisError(
      "AI_QUOTA_EXCEEDED",
      "The timetable analysis service has no available API quota. Please contact Kondo support.",
      503,
      false,
    );
  }
  if (status === 401 || status === 403) {
    return new ScheduleAnalysisError(
      "AI_AUTHENTICATION_FAILED",
      "The timetable analysis service is not configured correctly. Please contact Kondo support.",
      503,
      false,
    );
  }
  if (status === 429) {
    return new ScheduleAnalysisError(
      "AI_RATE_LIMITED",
      "The analysis model is temporarily busy. Please try again shortly.",
      503,
      true,
    );
  }
  if (status === 500 || status === 503) {
    return new ScheduleAnalysisError(
      "AI_PROVIDER_UNAVAILABLE",
      "The analysis model is temporarily unavailable. Please try again shortly.",
      503,
      true,
    );
  }
  return new ScheduleAnalysisError(
    "AI_DOCUMENT_REJECTED",
    providerType === "invalid_request_error"
      ? "The extracted timetable text was rejected by the analysis service. Please try again."
      : "The analysis service could not process the extracted timetable text.",
    422,
    status >= 500,
  );
}

function responseText(payload: Record<string, unknown>) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0];
  if (first && typeof first === "object") {
    const message = (first as { message?: unknown }).message;
    if (message && typeof message === "object") {
      const content = (message as { content?: unknown }).content;
      if (typeof content === "string" && content.trim()) {
        return content
          .trim()
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/, "")
          .trim();
      }
    }
  }
  throw new ScheduleAnalysisError(
    "AI_INVALID_RESPONSE",
    "The document text was read, but the analysis service returned no structured timetable data. Please try again.",
    502,
    true,
  );
}

class DeepSeekScheduleProvider implements ScheduleAnalysisProvider {
  async analyze(
    files: ScheduleFile[],
    context: PeriodContext,
    onStage?: (
      stage: "TEXT_EXTRACTION" | "STRUCTURED_EXTRACTION",
    ) => Promise<void> | void,
  ) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new ScheduleAnalysisError(
        "AI_NOT_CONFIGURED",
        "Timetable analysis is not configured yet. Please contact Kondo support.",
        503,
        false,
      );
    }
    const configuredModel = process.env.SCHEDULE_AI_MODEL?.trim();
    const model = DEEPSEEK_TIMETABLE_MODEL;
    if (configuredModel && configuredModel !== model) {
      logServerEvent("student-hub.schedule-analysis.model-override.ignored", {
        configuredModel,
        selectedModel: model,
        reason: "low-latency-structured-extraction",
      });
    }
    const timeout = Math.min(
      120_000,
      Math.max(20_000, Number(process.env.SCHEDULE_AI_TIMEOUT_MS) || 75_000),
    );

    const extractedDocuments: string[] = [];
    const diagnostics: DocumentQualityDiagnostic[] = [];

    await onStage?.("TEXT_EXTRACTION");
    for (const file of files) {
      logServerEvent("student-hub.schedule-analysis.file-read.started", {
        provider: file.storageProvider,
        mimeType: file.detectedMime,
        extension: file.originalFileName.split(".").pop()?.toLowerCase(),
      });
      let bytes: Uint8Array;
      try {
        bytes = await getObjectStorageForProvider(file.storageProvider).read(
          file.objectKey,
        );
      } catch (error) {
        logServerError(
          "student-hub.schedule-analysis.file-read.failed",
          error,
          { provider: file.storageProvider, mimeType: file.detectedMime },
        );
        throw new ScheduleAnalysisError(
          "STORAGE_READ_FAILED",
          "The uploaded file could not be read from media storage. Please upload it again.",
          502,
          true,
        );
      }
      logServerEvent("student-hub.schedule-analysis.file-read.completed", {
        provider: file.storageProvider,
        mimeType: file.detectedMime,
        sizeBytes: bytes.byteLength,
      });
      const mime = file.detectedMime ?? "application/octet-stream";
      try {
        const extracted = await extractDocumentText(bytes, mime);
        logServerEvent("student-hub.schedule-analysis.file-extracted", {
          mimeType: mime,
          sizeBytes: bytes.byteLength,
          method: extracted.method,
          pageCount: extracted.pageCount,
          characterCount: extracted.characterCount,
          confidence:
            extracted.confidence === null
              ? null
              : Math.round(extracted.confidence),
          warningCount: extracted.warnings.length,
          attempts: extracted.attempts.join(","),
        });
        const quality = assessExtractedDocument({
          text: extracted.text,
          confidence: extracted.confidence,
        });
        logServerEvent("student-hub.schedule-analysis.quality-checked", {
          fileName: file.originalFileName,
          accepted: quality.ok,
          usefulCharacterCount: quality.usefulCharacters,
          timetableSignalCount: quality.signalCount,
        });
        if (!quality.ok) {
          throw new ScheduleAnalysisError(
            quality.code,
            quality.message,
            422,
            true,
          );
        }
        diagnostics.push({
          fileName: file.originalFileName,
          mimeType: mime,
          method: extracted.method,
          pageCount: extracted.pageCount,
          characterCount: extracted.characterCount,
          confidence: extracted.confidence,
          warnings: extracted.warnings,
          attempts: extracted.attempts,
        });
        extractedDocuments.push(
          [
            `--- Document: ${file.originalFileName} ---`,
            `Extraction method: ${extracted.method}; pages: ${extracted.pageCount}`,
            extracted.warnings.length
              ? `Extraction warnings: ${extracted.warnings.join(" ")}`
              : "Extraction warnings: none",
            extracted.text,
          ].join("\n"),
        );
      } catch (error) {
        if (error instanceof DocumentExtractionError) {
          const code =
            error.code === "LOW_QUALITY"
              ? "DOCUMENT_TOO_BLURRY"
              : error.code === "UNSUPPORTED_TYPE"
                ? "DOCUMENT_UNSUPPORTED"
                : error.code === "PAGE_LIMIT"
                  ? "DOCUMENT_PAGE_LIMIT"
                  : "DOCUMENT_TEXT_EXTRACTION_FAILED";
          throw new ScheduleAnalysisError(
            code,
            error.message,
            422,
            error.retryable,
          );
        }
        throw error;
      }
    }

    await onStage?.("STRUCTURED_EXTRACTION");
    const systemPrompt = [
      "You extract university timetables from OCR or embedded PDF text.",
      "Return exactly one JSON object matching the supplied JSON schema. Do not wrap it in markdown.",
      "The output must be valid JSON, even when some OCR text is incomplete.",
      "Read Chinese and English text, merged table cells, numbered periods, 1-16周, 单周 (odd weeks), and 双周 (even weeks).",
      "Do not invent missing values. Use null and add the field name to uncertainFields when uncertain.",
      "Keep partially readable courses and lower their confidence instead of rejecting the whole document.",
      "If an OCR warning is present, add a concise warning to the warnings array.",
      `JSON schema: ${JSON.stringify(SCHEDULE_EXTRACTION_JSON_SCHEMA)}`,
      `Example JSON: ${JSON.stringify({
        title: "Fall timetable",
        warnings: ["Room was uncertain for one course."],
        courses: [
          {
            courseName: "Business English",
            teacher: "Dr. Chen",
            dayOfWeek: "MONDAY",
            specificDate: null,
            startPeriod: null,
            endPeriod: null,
            startTime: "08:00",
            endTime: "09:30",
            room: "A201",
            building: null,
            campus: null,
            startWeek: 1,
            endWeek: 18,
            weekPattern: "ALL",
            weeks: [],
            language: "en",
            notes: null,
            confidence: 0.9,
            uncertainFields: [],
          },
        ],
      })}`,
    ].join("\n");
    const userPrompt = [
      `University context: ${context.university}. Campus: ${context.campus ?? "not specified"}. Term: ${context.term ?? "not specified"}. Timezone: ${context.timezone}.`,
      `Official period mapping: ${JSON.stringify(context.periods)}. Use it only when a numbered period is present.`,
      "Extract only the timetable contained in these documents and respond as JSON:",
      extractedDocuments.join("\n\n"),
    ].join("\n\n");

    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const controller = new AbortController();
      const abort = setTimeout(() => controller.abort(), timeout);
      try {
        logServerEvent("student-hub.schedule-analysis.provider.started", {
          provider: "deepseek",
          model,
          attempt,
          fileCount: files.length,
        });
        const response = await fetch(
          "https://api.deepseek.com/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: systemPrompt },
                {
                  role: "user",
                  content:
                    attempt === 1
                      ? userPrompt
                      : `${userPrompt}\n\nThe previous attempt returned empty or invalid JSON. Return one complete, non-empty JSON object now.`,
                },
              ],
              response_format: { type: "json_object" },
              thinking: { type: "disabled" },
              temperature: 0,
              max_tokens: 8_192,
              stream: false,
            }),
            signal: controller.signal,
          },
        );
        const responseBody = await response.text();
        let payload: Record<string, unknown> | null = null;
        try {
          const candidate = JSON.parse(responseBody) as unknown;
          if (candidate && typeof candidate === "object") {
            payload = candidate as Record<string, unknown>;
          }
        } catch {
          payload = null;
        }
        const choices = Array.isArray(payload?.choices) ? payload.choices : [];
        const firstChoice =
          choices[0] && typeof choices[0] === "object"
            ? (choices[0] as Record<string, unknown>)
            : {};
        const message =
          firstChoice.message && typeof firstChoice.message === "object"
            ? (firstChoice.message as Record<string, unknown>)
            : {};
        const providerDetails =
          payload?.error && typeof payload.error === "object"
            ? (payload.error as Record<string, unknown>)
            : {};
        logServerEvent("student-hub.schedule-analysis.provider.responded", {
          provider: "deepseek",
          model,
          attempt,
          status: response.status,
          requestId: response.headers.get("x-request-id"),
          contentType: response.headers.get("content-type"),
          responseBytes: Buffer.byteLength(responseBody),
          payloadParsed: Boolean(payload),
          finishReason:
            typeof firstChoice.finish_reason === "string"
              ? firstChoice.finish_reason
              : null,
          messageCharacterCount:
            typeof message.content === "string" ? message.content.length : 0,
          providerErrorCode:
            typeof providerDetails.code === "string"
              ? providerDetails.code
              : null,
          providerErrorType:
            typeof providerDetails.type === "string"
              ? providerDetails.type
              : null,
        });
        if (!response.ok) {
          const failure = providerError(response.status, payload);
          if (!failure.retryable) throw failure;
          lastError = failure;
          continue;
        }
        if (!payload) {
          lastError = new ScheduleAnalysisError(
            "AI_INVALID_RESPONSE",
            "The analysis service returned an empty or invalid response. Please try again.",
            502,
            true,
          );
          continue;
        }
        let parsed: ExtractedSchedule;
        try {
          const providerJson = JSON.parse(responseText(payload));
          parsed = scheduleExtractionSchema.parse(
            normalizeScheduleExtractionCandidate(providerJson),
          );
          if (parsed.courses.length === 0) {
            throw new ScheduleAnalysisError(
              "NO_COURSE_NAMES",
              "Text extraction succeeded, but no course names were found. Make sure the uploaded page includes the timetable grid and course labels, then try again.",
              422,
              true,
            );
          }
        } catch (error) {
          if (error instanceof ScheduleAnalysisError) throw error;
          if (error instanceof SyntaxError || error instanceof ZodError) {
            const validation =
              error instanceof ZodError
                ? describeTimetableValidation(error)
                : {
                    message:
                      "The analysis service returned malformed JSON and no timetable could be reconstructed.",
                    issues: [
                      {
                        path: "json",
                        message:
                          "The analysis service returned malformed JSON and no timetable could be reconstructed.",
                      },
                    ],
                  };
            logServerError(
              "student-hub.schedule-analysis.response-validation.failed",
              error,
              {
                provider: "deepseek",
                model,
                attempt,
                issueCount: error instanceof ZodError ? error.issues.length : 1,
                issuePaths:
                  error instanceof ZodError
                    ? error.issues
                        .slice(0, 8)
                        .map((issue) => issue.path.join("."))
                        .join(",")
                    : "json",
                firstIssuePath: validation.issues[0]?.path ?? "unknown",
              },
            );
            throw new ScheduleAnalysisError(
              "TIMETABLE_RECONSTRUCTION_FAILED",
              `Text extraction succeeded, but the timetable could not be reconstructed: ${validation.message}`,
              502,
              true,
            );
          }
          throw error;
        }
        const usage = (payload.usage ?? {}) as Record<string, unknown>;
        logServerEvent("student-hub.schedule-analysis.validated", {
          provider: "deepseek",
          model,
          courseCount: parsed.courses.length,
          warningCount: parsed.warnings.length,
        });
        return {
          extraction: parsed,
          provider: "deepseek",
          model,
          inputTokens:
            typeof usage.prompt_tokens === "number"
              ? usage.prompt_tokens
              : null,
          outputTokens:
            typeof usage.completion_tokens === "number"
              ? usage.completion_tokens
              : null,
          diagnostics,
        };
      } catch (error) {
        if (error instanceof ScheduleAnalysisError) {
          lastError = error;
          if (!error.retryable) break;
          continue;
        }
        if (error instanceof Error && error.name === "AbortError") {
          lastError = new ScheduleAnalysisError(
            "AI_TIMEOUT",
            "The analysis service took too long to respond. Please try again shortly.",
            504,
            true,
          );
          continue;
        }
        lastError = new ScheduleAnalysisError(
          "AI_PROVIDER_UNAVAILABLE",
          "The analysis model is temporarily unavailable. Please try again shortly.",
          503,
          true,
        );
      } finally {
        clearTimeout(abort);
      }
    }
    logServerError("student-hub.schedule-analysis.failed", lastError, {
      provider: "deepseek",
      model,
      fileCount: files.length,
    });
    if (lastError instanceof ScheduleAnalysisError) throw lastError;
    throw new ScheduleAnalysisError(
      "AI_PROVIDER_UNAVAILABLE",
      "The analysis model is temporarily unavailable. Please try again shortly.",
      503,
      true,
    );
  }
}

export function getScheduleAnalysisProvider(): ScheduleAnalysisProvider {
  const provider =
    process.env.SCHEDULE_AI_PROVIDER?.trim().toLowerCase() || "deepseek";
  if (provider === "deepseek") return new DeepSeekScheduleProvider();
  throw new Error(`Unsupported schedule analysis provider: ${provider}`);
}
