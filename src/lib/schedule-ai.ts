import type { MediaAsset } from "@prisma/client";
import { ZodError } from "zod";
import {
  SCHEDULE_EXTRACTION_JSON_SCHEMA,
  scheduleExtractionSchema,
  type ExtractedSchedule,
} from "@/features/student-hub/schemas";
import { logServerError, logServerEvent } from "@/lib/logger";
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

export type ScheduleAnalysis = {
  extraction: ExtractedSchedule;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export interface ScheduleAnalysisProvider {
  analyze(
    files: ScheduleFile[],
    context: PeriodContext,
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

  if (status === 429 && providerCode === "insufficient_quota") {
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
  if (status >= 500) {
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
      ? "The file could not be processed by the analysis model. Try a clearer PDF or image."
      : "This document could not be analyzed. Try a clearer PDF or image.",
    422,
    false,
  );
}

function responseText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content)
      ? ((item as { content: unknown[] }).content ?? [])
      : [];
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        return (part as { text: string }).text;
      }
    }
  }
  throw new ScheduleAnalysisError(
    "AI_INVALID_RESPONSE",
    "The document was read, but its timetable could not be understood. Try a clearer file.",
    502,
    false,
  );
}

class OpenAIScheduleProvider implements ScheduleAnalysisProvider {
  async analyze(files: ScheduleFile[], context: PeriodContext) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ScheduleAnalysisError(
        "AI_NOT_CONFIGURED",
        "Timetable analysis is not configured yet. Please contact Kondo support.",
        503,
        false,
      );
    }
    const model = process.env.SCHEDULE_AI_MODEL?.trim() || "gpt-5.6-terra";
    const timeout = Math.min(
      120_000,
      Math.max(10_000, Number(process.env.SCHEDULE_AI_TIMEOUT_MS) || 60_000),
    );

    const content: Array<Record<string, unknown>> = [
      {
        type: "input_text",
        text: [
          "Extract only the university timetable shown in the attached files.",
          "Read Chinese and English text, merged table cells, numbered periods, 1-16周, 单周 (odd weeks), and 双周 (even weeks).",
          "Do not invent missing values. Use null and add the field name to uncertainFields when uncertain.",
          `University context: ${context.university}. Campus: ${context.campus ?? "not specified"}. Term: ${context.term ?? "not specified"}. Timezone: ${context.timezone}.`,
          `Official period mapping: ${JSON.stringify(context.periods)}. Use it only when a numbered period is present.`,
        ].join("\n"),
      },
    ];

    for (const file of files) {
      logServerEvent("student-hub.schedule-analysis.file-read.started", {
        provider: file.storageProvider,
        mimeType: file.detectedMime,
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
      const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
      content.push(
        mime === "application/pdf"
          ? {
              type: "input_file",
              filename: file.originalFileName,
              file_data: dataUrl,
              detail: "high",
            }
          : { type: "input_image", image_url: dataUrl, detail: "high" },
      );
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const controller = new AbortController();
      const abort = setTimeout(() => controller.abort(), timeout);
      try {
        logServerEvent("student-hub.schedule-analysis.provider.started", {
          provider: "openai",
          model,
          attempt,
          fileCount: files.length,
        });
        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            store: false,
            input: [{ role: "user", content }],
            reasoning: { effort: "low" },
            text: {
              format: {
                type: "json_schema",
                name: "kondo_schedule_extraction",
                strict: true,
                schema: SCHEDULE_EXTRACTION_JSON_SCHEMA,
              },
            },
          }),
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as Record<
          string,
          unknown
        > | null;
        logServerEvent("student-hub.schedule-analysis.provider.responded", {
          provider: "openai",
          model,
          attempt,
          status: response.status,
          requestId: response.headers.get("x-request-id"),
        });
        if (!response.ok || !payload) {
          const failure = providerError(response.status, payload);
          if (!failure.retryable) throw failure;
          lastError = failure;
          continue;
        }
        let parsed: ExtractedSchedule;
        try {
          parsed = scheduleExtractionSchema.parse(
            JSON.parse(responseText(payload)),
          );
        } catch (error) {
          if (error instanceof ScheduleAnalysisError) throw error;
          if (error instanceof SyntaxError || error instanceof ZodError) {
            throw new ScheduleAnalysisError(
              "AI_INVALID_RESPONSE",
              "The document was read, but its timetable could not be understood. Try a clearer file.",
              502,
              false,
            );
          }
          throw error;
        }
        const usage = (payload.usage ?? {}) as Record<string, unknown>;
        logServerEvent("student-hub.schedule-analysis.validated", {
          provider: "openai",
          model,
          courseCount: parsed.courses.length,
          warningCount: parsed.warnings.length,
        });
        return {
          extraction: parsed,
          provider: "openai",
          model,
          inputTokens:
            typeof usage.input_tokens === "number" ? usage.input_tokens : null,
          outputTokens:
            typeof usage.output_tokens === "number"
              ? usage.output_tokens
              : null,
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
            "The timetable analysis took too long. Try a smaller or clearer file.",
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
      provider: "openai",
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
    process.env.SCHEDULE_AI_PROVIDER?.trim().toLowerCase() || "openai";
  if (provider === "openai") return new OpenAIScheduleProvider();
  throw new Error(`Unsupported schedule analysis provider: ${provider}`);
}
