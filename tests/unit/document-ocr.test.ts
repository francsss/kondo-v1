import { PDFDocument, loadImage } from "@napi-rs/canvas";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  disposeDocumentOcrWorker,
  extractDocumentText,
} from "@/lib/document-ocr";

function timetableSvg(day: string, course: string) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
      <rect width="100%" height="100%" fill="white"/>
      <text x="80" y="150" font-size="72" font-family="Arial" fill="black">${day} TIMETABLE</text>
      <text x="80" y="300" font-size="58" font-family="Arial" fill="black">08:00 - 09:30 ${course}</text>
      <text x="80" y="410" font-size="58" font-family="Arial" fill="black">Room A-201 Professor Li</text>
    </svg>`,
  );
}

async function imageTimetable(day: string, course: string) {
  return sharp(timetableSvg(day, course)).png().toBuffer();
}

async function scannedPdfTimetable(day: string, course: string) {
  const image = await loadImage(await imageTimetable(day, course));
  const document = new PDFDocument();
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
  return document.close();
}

describe("timetable document OCR", () => {
  beforeAll(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterAll(async () => {
    await disposeDocumentOcrWorker();
    vi.restoreAllMocks();
  });

  it("extracts timetable text from an image", async () => {
    const result = await extractDocumentText(
      await imageTimetable("MONDAY", "International Business"),
      "image/png",
    );

    expect(result).toMatchObject({ method: "ocr", pageCount: 1 });
    expect(result.text).toContain("International Business");
  }, 30_000);

  it("renders and extracts timetable text from a scanned PDF", async () => {
    const result = await extractDocumentText(
      await scannedPdfTimetable("TUESDAY", "Computer Science"),
      "application/pdf",
    );

    expect(result).toMatchObject({ method: "ocr", pageCount: 1 });
    expect(result.text).toContain("Computer Science");
  }, 30_000);
});
