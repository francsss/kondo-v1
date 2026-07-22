import { PDFDocument, loadImage } from "@napi-rs/canvas";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  type DocumentTextExtraction,
  disposeDocumentOcrWorker,
  extractDocumentText,
} from "@/lib/document-ocr";

function logFixtureResult(
  fixture: string,
  result: DocumentTextExtraction,
  expectedCourses: string[],
) {
  if (process.env.SCHEDULE_OCR_TEST_LOGS !== "1") return;
  console.info(
    JSON.stringify({
      fixture,
      method: result.method,
      pageCount: result.pageCount,
      characterCount: result.characterCount,
      confidence:
        result.confidence === null ? null : Math.round(result.confidence),
      warnings: result.warnings,
      attempts: result.attempts,
      expectedCourses,
      expectedCoursesFound: expectedCourses.every((course) =>
        result.text.includes(course),
      ),
    }),
  );
}

function timetableSvg(
  day: string,
  course: string,
  colors = { background: "white", foreground: "black" },
) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
      <rect width="100%" height="100%" fill="${colors.background}"/>
      <text x="80" y="150" font-size="72" font-family="Arial" fill="${colors.foreground}">${day} TIMETABLE</text>
      <text x="80" y="300" font-size="58" font-family="Arial" fill="${colors.foreground}">08:00 - 09:30 ${course}</text>
      <text x="80" y="410" font-size="58" font-family="Arial" fill="${colors.foreground}">Room A-201 Professor Li</text>
    </svg>`,
  );
}

async function imageTimetable(
  day: string,
  course: string,
  format: "jpeg" | "png" = "png",
  dark = false,
) {
  const pipeline = sharp(
    timetableSvg(
      day,
      course,
      dark ? { background: "#101916", foreground: "#f5fff9" } : undefined,
    ),
  );
  return format === "jpeg"
    ? pipeline.jpeg({ quality: 86 }).toBuffer()
    : pipeline.png().toBuffer();
}

async function scannedPdfTimetable(
  pages: Array<{ day: string; course: string }>,
) {
  const document = new PDFDocument();
  for (const fixture of pages) {
    const image = await loadImage(
      await imageTimetable(fixture.day, fixture.course),
    );
    const context = document.beginPage(800, 450);
    const drawableContext = context as unknown as {
      drawImage(
        source: typeof image,
        x: number,
        y: number,
        width: number,
        height: number,
      ): void;
    };
    drawableContext.drawImage(image, 0, 0, 800, 450);
    document.endPage();
  }
  return document.close();
}

function nativePdfTimetable() {
  const document = new PDFDocument();
  const context = document.beginPage(900, 600);
  context.fillStyle = "white";
  context.fillRect(0, 0, 900, 600);
  context.fillStyle = "black";
  context.font = "bold 34px Arial";
  context.fillText("FALL 2026 TIMETABLE", 60, 80);
  context.font = "26px Arial";
  context.fillText("Monday 08:00 - 09:30 Business English Room A201", 60, 170);
  context.fillText("Tuesday 10:00 - 11:30 Data Analytics Lab D04", 60, 240);
  context.fillText(
    "Wednesday 14:00 - 15:30 International Trade Room B105",
    60,
    310,
  );
  document.endPage();
  return document.close();
}

describe("timetable document extraction", () => {
  beforeAll(() => {
    if (process.env.SCHEDULE_OCR_TEST_LOGS !== "1") {
      vi.spyOn(console, "info").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
    }
  });

  afterAll(async () => {
    await disposeDocumentOcrWorker();
    vi.restoreAllMocks();
  });

  it("extracts a native text PDF before attempting OCR", async () => {
    const result = await extractDocumentText(
      await nativePdfTimetable(),
      "application/pdf",
    );

    expect(result).toMatchObject({
      method: "embedded-pdf-text",
      pageCount: 1,
      warnings: [],
    });
    expect(result.text).toContain("Business English");
    expect(result.attempts).toEqual(["embedded-pdf-text"]);
    logFixtureResult("native-text-pdf", result, ["Business English"]);
  });

  it("renders a scanned PDF and extracts it with OCR", async () => {
    const result = await extractDocumentText(
      await scannedPdfTimetable([
        { day: "TUESDAY", course: "Computer Science" },
      ]),
      "application/pdf",
    );

    expect(result).toMatchObject({ method: "pdf-ocr", pageCount: 1 });
    expect(result.text).toContain("Computer Science");
    expect(result.attempts).toEqual(["embedded-pdf-text", "rendered-pdf-ocr"]);
    logFixtureResult("scanned-pdf", result, ["Computer Science"]);
  }, 45_000);

  it("extracts a JPEG timetable", async () => {
    const result = await extractDocumentText(
      await imageTimetable("WEDNESDAY", "Marketing Principles", "jpeg"),
      "image/jpeg",
    );

    expect(result).toMatchObject({ method: "image-ocr", pageCount: 1 });
    expect(result.text).toContain("Marketing Principles");
    logFixtureResult("jpeg-image", result, ["Marketing Principles"]);
  }, 45_000);

  it("enhances a dark PNG screenshot before OCR", async () => {
    const result = await extractDocumentText(
      await imageTimetable("THURSDAY", "Chinese Language", "png", true),
      "image/png",
    );

    expect(result).toMatchObject({ method: "image-ocr", pageCount: 1 });
    expect(result.text).toContain("Chinese Language");
    expect(
      result.attempts.some((attempt) => attempt.includes("inverted")),
    ).toBe(true);
    logFixtureResult("dark-png-screenshot", result, ["Chinese Language"]);
  }, 45_000);

  it("reads every page of a multi-page scanned document", async () => {
    const result = await extractDocumentText(
      await scannedPdfTimetable([
        { day: "MONDAY", course: "Microeconomics" },
        { day: "TUESDAY", course: "International Trade" },
        { day: "FRIDAY", course: "Career Workshop" },
      ]),
      "application/pdf",
    );

    expect(result).toMatchObject({ method: "pdf-ocr", pageCount: 3 });
    expect(result.text).toContain("Microeconomics");
    expect(result.text).toContain("International Trade");
    expect(result.text).toContain("Career Workshop");
    logFixtureResult("multi-page-scanned-pdf", result, [
      "Microeconomics",
      "International Trade",
      "Career Workshop",
    ]);
  }, 90_000);
});
