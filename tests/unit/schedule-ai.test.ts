import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageRead = vi.hoisted(() => vi.fn());

vi.mock("@/lib/storage", () => ({
  getObjectStorageForProvider: () => ({ read: storageRead }),
}));

import { getScheduleAnalysisProvider } from "@/lib/schedule-ai";

const extraction = {
  title: "Spring timetable",
  warnings: [],
  courses: [
    {
      courseName: "International Business",
      teacher: "Professor Li",
      dayOfWeek: "MONDAY",
      specificDate: null,
      startPeriod: null,
      endPeriod: null,
      startTime: "08:00",
      endTime: "09:30",
      room: "A-201",
      building: null,
      campus: null,
      startWeek: 1,
      endWeek: 16,
      weekPattern: "ALL",
      weeks: [],
      language: "en",
      notes: null,
      confidence: 0.98,
      uncertainFields: [],
    },
  ],
};

const context = {
  university: "Test University",
  campus: "Main campus",
  term: "Spring",
  timezone: "Asia/Shanghai",
  periods: [],
};

function file(detectedMime: string, originalFileName: string) {
  return {
    objectKey: `private/${originalFileName}`,
    storageProvider: "S3" as const,
    detectedMime,
    originalFileName,
  };
}

function successfulResponse() {
  return new Response(
    JSON.stringify({
      output_text: JSON.stringify(extraction),
      usage: { input_tokens: 120, output_tokens: 80 },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "x-request-id": "r1" },
    },
  );
}

describe("OpenAI timetable analysis", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test-key-with-enough-characters";
    process.env.SCHEDULE_AI_PROVIDER = "openai";
    process.env.SCHEDULE_AI_MODEL = "gpt-5.6-terra";
    process.env.SCHEDULE_AI_TIMEOUT_MS = "10000";
    storageRead.mockReset();
    storageRead.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends an uploaded timetable image as an image input", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await getScheduleAnalysisProvider().analyze(
      [file("image/png", "timetable.png")],
      context,
    );

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request.input[0].content[1]).toMatchObject({
      type: "input_image",
      detail: "high",
    });
    expect(result.extraction.courses[0]?.courseName).toBe(
      "International Business",
    );
  });

  it("sends an uploaded timetable PDF as a high-detail file input", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulResponse());
    vi.stubGlobal("fetch", fetchMock);

    await getScheduleAnalysisProvider().analyze(
      [file("application/pdf", "timetable.pdf")],
      context,
    );

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request.input[0].content[1]).toMatchObject({
      type: "input_file",
      filename: "timetable.pdf",
      detail: "high",
    });
  });

  it("surfaces exhausted API quota without a pointless retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            type: "insufficient_quota",
            code: "insufficient_quota",
            message: "quota details that must not reach the user",
          },
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getScheduleAnalysisProvider().analyze(
        [file("image/jpeg", "timetable.jpg")],
        context,
      ),
    ).rejects.toMatchObject({
      code: "AI_QUOTA_EXCEEDED",
      status: 503,
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("distinguishes a missing R2 object from an OpenAI failure", async () => {
    storageRead.mockRejectedValueOnce(new Error("NoSuchKey"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getScheduleAnalysisProvider().analyze(
        [file("image/jpeg", "missing.jpg")],
        context,
      ),
    ).rejects.toMatchObject({
      code: "STORAGE_READ_FAILED",
      status: 502,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
