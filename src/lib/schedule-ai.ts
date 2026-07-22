import type { MediaAsset } from "@prisma/client";
import {
  SCHEDULE_EXTRACTION_JSON_SCHEMA,
  scheduleExtractionSchema,
  type ExtractedSchedule,
} from "@/features/student-hub/schemas";
import { logServerError } from "@/lib/logger";
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
  throw new Error("The analysis provider returned no structured output.");
}

class OpenAIScheduleProvider implements ScheduleAnalysisProvider {
  async analyze(files: ScheduleFile[], context: PeriodContext) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Schedule analysis is not configured.");
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
      const bytes = await getObjectStorageForProvider(
        file.storageProvider,
      ).read(file.objectKey);
      const mime = file.detectedMime ?? "application/octet-stream";
      const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
      content.push(
        mime === "application/pdf"
          ? {
              type: "input_file",
              filename: file.originalFileName,
              file_data: dataUrl,
            }
          : { type: "input_image", image_url: dataUrl, detail: "high" },
      );
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const controller = new AbortController();
      const abort = setTimeout(() => controller.abort(), timeout);
      try {
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
        if (!response.ok || !payload) {
          const providerError = new Error(
            `Schedule provider error ${response.status}`,
          );
          if (response.status < 500 && response.status !== 429)
            throw providerError;
          lastError = providerError;
          continue;
        }
        const parsed = scheduleExtractionSchema.parse(
          JSON.parse(responseText(payload)),
        );
        const usage = (payload.usage ?? {}) as Record<string, unknown>;
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
        lastError = error;
        if (error instanceof SyntaxError) break;
      } finally {
        clearTimeout(abort);
      }
    }
    logServerError("student-hub.schedule-analysis.failed", lastError, {
      provider: "openai",
      model,
      fileCount: files.length,
    });
    throw new Error("The timetable could not be analyzed. Please try again.");
  }
}

export function getScheduleAnalysisProvider(): ScheduleAnalysisProvider {
  const provider =
    process.env.SCHEDULE_AI_PROVIDER?.trim().toLowerCase() || "openai";
  if (provider === "openai") return new OpenAIScheduleProvider();
  throw new Error(`Unsupported schedule analysis provider: ${provider}`);
}
