import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageRead = vi.hoisted(() => vi.fn());
const extractDocumentText = vi.hoisted(() => vi.fn());

vi.mock("@/lib/storage", () => ({
  getObjectStorageForProvider: () => ({ read: storageRead }),
}));

vi.mock("@/lib/document-ocr", () => ({
  DocumentExtractionError: class DocumentExtractionError extends Error {
    retryable = false;
  },
  extractDocumentText,
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
      choices: [{ message: { content: JSON.stringify(extraction) } }],
      usage: { prompt_tokens: 120, completion_tokens: 80 },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "x-request-id": "r1" },
    },
  );
}

describe("DeepSeek timetable analysis", () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = "sk-test-key-with-enough-characters";
    process.env.SCHEDULE_AI_PROVIDER = "deepseek";
    process.env.SCHEDULE_AI_MODEL = "deepseek-v4-pro";
    process.env.SCHEDULE_AI_TIMEOUT_MS = "10000";
    storageRead.mockReset();
    storageRead.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
    extractDocumentText.mockReset();
    extractDocumentText.mockResolvedValue({
      text: "Monday 08:00 International Business A-201",
      method: "image-ocr",
      pageCount: 1,
      characterCount: 45,
      confidence: 91,
      warnings: [],
      attempts: ["auto-rotate-resize-contrast-ocr", "normalized"],
    });
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ["image/png", "timetable.png"],
    ["application/pdf", "timetable.pdf"],
  ])(
    "extracts %s locally and sends only text to DeepSeek",
    async (mime, name) => {
      const fetchMock = vi.fn().mockResolvedValue(successfulResponse());
      vi.stubGlobal("fetch", fetchMock);

      const result = await getScheduleAnalysisProvider().analyze(
        [file(mime, name)],
        context,
      );

      expect(extractDocumentText).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        mime,
      );
      const [url, init] = fetchMock.mock.calls[0] ?? [];
      expect(url).toBe("https://api.deepseek.com/chat/completions");
      const request = JSON.parse(String(init?.body));
      expect(request).toMatchObject({
        model: "deepseek-v4-flash",
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        temperature: 0,
      });
      expect(request.messages[1].content).toContain(
        "Monday 08:00 International Business A-201",
      );
      expect(request.messages[1].content).not.toContain("data:image");
      expect(result).toMatchObject({
        provider: "deepseek",
        model: "deepseek-v4-flash",
        inputTokens: 120,
        outputTokens: 80,
      });
    },
  );

  it("surfaces insufficient DeepSeek balance without a pointless retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            type: "insufficient_balance",
            code: "insufficient_balance",
            message: "balance details that must not reach the user",
          },
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
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

  it("distinguishes a missing R2 object from a DeepSeek failure", async () => {
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

  it("retries an invalid HTTP 200 body instead of blaming the document", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(successfulResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await getScheduleAnalysisProvider().analyze(
      [file("image/png", "timetable.png")],
      context,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.extraction.courses).toHaveLength(1);
  });

  it("retries JSON that does not satisfy the timetable schema", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              { message: { content: JSON.stringify({ courses: [] }) } },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(successfulResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await getScheduleAnalysisProvider().analyze(
      [file("application/pdf", "timetable.pdf")],
      context,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.extraction.title).toBe("Spring timetable");
  });
});
