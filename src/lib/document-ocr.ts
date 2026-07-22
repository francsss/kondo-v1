import { copyFile, mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { logServerEvent } from "@/lib/logger";

const MAX_PDF_PAGES = 12;
const MIN_EMBEDDED_TEXT_LENGTH = 40;
const TESSDATA_DIRECTORY = join(tmpdir(), "kondo-tessdata-v1");
const BUNDLED_LANGUAGE_DATA = [
  {
    language: "eng",
    source: join(process.cwd(), "vendor/tessdata/eng.traineddata.gz"),
  },
  {
    language: "chi_sim",
    source: join(process.cwd(), "vendor/tessdata/chi_sim.traineddata.gz"),
  },
] as const;

type OcrWorker = Awaited<
  ReturnType<(typeof import("tesseract.js"))["createWorker"]>
>;

export type DocumentTextExtraction = {
  text: string;
  method: "embedded-pdf-text" | "ocr";
  pageCount: number;
};

export class DocumentExtractionError extends Error {
  constructor(
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "DocumentExtractionError";
  }
}

let workerPromise: Promise<OcrWorker> | null = null;
let ocrQueue: Promise<void> = Promise.resolve();

async function fileExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function prepareBundledLanguageData() {
  await mkdir(TESSDATA_DIRECTORY, { recursive: true });
  for (const { language, source } of BUNDLED_LANGUAGE_DATA) {
    const target = join(TESSDATA_DIRECTORY, `${language}.traineddata.gz`);
    if (await fileExists(target)) continue;
    await copyFile(source, target);
  }
  return TESSDATA_DIRECTORY;
}

async function getOcrWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const [{ createWorker, OEM, PSM }, langPath] = await Promise.all([
        import("tesseract.js"),
        prepareBundledLanguageData(),
      ]);
      const worker = await createWorker(["eng", "chi_sim"], OEM.LSTM_ONLY, {
        cacheMethod: "none",
        gzip: true,
        langPath,
      });
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: PSM.AUTO,
        user_defined_dpi: "300",
      });
      return worker;
    })().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

async function preprocessImage(bytes: Uint8Array) {
  return sharp(bytes, { failOn: "error", limitInputPixels: 50_000_000 })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({
      width: 2800,
      height: 2800,
      fit: "inside",
      withoutEnlargement: true,
    })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}

async function recognizeImage(bytes: Uint8Array) {
  let releaseQueue: (() => void) | undefined;
  const previous = ocrQueue;
  ocrQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });
  await previous;
  try {
    const [worker, prepared] = await Promise.all([
      getOcrWorker(),
      preprocessImage(bytes),
    ]);
    const result = await worker.recognize(prepared);
    return result.data.text.trim();
  } catch (error) {
    workerPromise = null;
    throw error;
  } finally {
    releaseQueue?.();
  }
}

async function extractEmbeddedPdfText(bytes: Uint8Array) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({
    data: Uint8Array.from(bytes),
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;
  try {
    if (document.numPages > MAX_PDF_PAGES) {
      throw new DocumentExtractionError(
        `PDF timetables can contain at most ${MAX_PDF_PAGES} pages.`,
      );
    }
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) pages.push(`[Page ${pageNumber}]\n${text}`);
      page.cleanup();
    }
    return { pageCount: document.numPages, text: pages.join("\n\n") };
  } finally {
    await document.destroy();
  }
}

async function extractScannedPdfText(bytes: Uint8Array, pageCount: number) {
  const { pdf } = await import("pdf-to-img");
  const document = await pdf(Buffer.from(bytes), {
    scale: 2.2,
    docInitParams: { isEvalSupported: false, useSystemFonts: true },
  });
  try {
    const pages: string[] = [];
    const pagesToRead = Math.min(pageCount, document.length, MAX_PDF_PAGES);
    for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
      logServerEvent("student-hub.schedule-analysis.ocr.page.started", {
        pageNumber,
        pageCount: pagesToRead,
        mimeType: "application/pdf",
      });
      const text = await recognizeImage(await document.getPage(pageNumber));
      if (text) pages.push(`[Page ${pageNumber}]\n${text}`);
    }
    return pages.join("\n\n");
  } finally {
    await document.destroy();
  }
}

export async function extractDocumentText(
  bytes: Uint8Array,
  mimeType: string,
): Promise<DocumentTextExtraction> {
  logServerEvent("student-hub.schedule-analysis.document-extraction.started", {
    mimeType,
    sizeBytes: bytes.byteLength,
  });
  try {
    if (mimeType === "application/pdf") {
      const embedded = await extractEmbeddedPdfText(bytes);
      if (embedded.text.replace(/\s/g, "").length >= MIN_EMBEDDED_TEXT_LENGTH) {
        logServerEvent(
          "student-hub.schedule-analysis.document-extraction.completed",
          {
            mimeType,
            method: "embedded-pdf-text",
            pageCount: embedded.pageCount,
            characterCount: embedded.text.length,
          },
        );
        return {
          text: embedded.text,
          method: "embedded-pdf-text",
          pageCount: embedded.pageCount,
        };
      }
      const text = await extractScannedPdfText(bytes, embedded.pageCount);
      if (!text.trim()) {
        throw new DocumentExtractionError(
          "No readable timetable text was found in this PDF.",
        );
      }
      logServerEvent(
        "student-hub.schedule-analysis.document-extraction.completed",
        {
          mimeType,
          method: "ocr",
          pageCount: embedded.pageCount,
          characterCount: text.length,
        },
      );
      return { text, method: "ocr", pageCount: embedded.pageCount };
    }

    if (["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      const text = await recognizeImage(bytes);
      if (!text.trim()) {
        throw new DocumentExtractionError(
          "No readable timetable text was found in this image.",
        );
      }
      logServerEvent(
        "student-hub.schedule-analysis.document-extraction.completed",
        {
          mimeType,
          method: "ocr",
          pageCount: 1,
          characterCount: text.length,
        },
      );
      return { text, method: "ocr", pageCount: 1 };
    }

    throw new DocumentExtractionError(
      "This timetable file type is not supported.",
    );
  } catch (error) {
    if (error instanceof DocumentExtractionError) throw error;
    throw new DocumentExtractionError(
      "The file could not be converted into readable timetable text.",
      true,
    );
  }
}

export async function disposeDocumentOcrWorker() {
  const activeWorker = workerPromise;
  workerPromise = null;
  if (activeWorker) {
    await (await activeWorker).terminate();
  }
}
