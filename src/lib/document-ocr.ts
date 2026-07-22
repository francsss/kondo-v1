import { copyFile, mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { logServerError, logServerEvent } from "@/lib/logger";

const MAX_PDF_PAGES = 10;
const MIN_USABLE_CHARACTERS = 8;
const MIN_STRONG_TEXT_CHARACTERS = 40;
const MAX_OCR_EDGE = 3_600;
const MIN_OCR_EDGE = 1_800;
const TESSDATA_DIRECTORY = join(tmpdir(), "kondo-tessdata-v1");
const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
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

type TextQuality = {
  usefulCharacters: number;
  timetableSignals: number;
  score: number;
  strong: boolean;
};

type OcrResult = {
  text: string;
  confidence: number;
  method: string;
  quality: TextQuality;
};

export type DocumentTextExtraction = {
  text: string;
  method: "embedded-pdf-text" | "pdf-ocr" | "image-ocr" | "hybrid-pdf-text-ocr";
  pageCount: number;
  characterCount: number;
  confidence: number | null;
  warnings: string[];
  attempts: string[];
};

export class DocumentExtractionError extends Error {
  constructor(
    message: string,
    public readonly retryable = false,
    public readonly attempts: string[] = [],
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

function detectDocumentMime(bytes: Uint8Array) {
  if (
    bytes.length >= 5 &&
    new TextDecoder("latin1").decode(bytes.slice(0, 5)) === "%PDF-"
  ) {
    return "application/pdf";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    )
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    new TextDecoder("latin1").decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder("latin1").decode(bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function textQuality(text: string, confidence = 0): TextQuality {
  const usefulCharacters = text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
  const timetableSignals = [
    /\b(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i,
    /(?:星期[一二三四五六日天]|周[一二三四五六日天])/,
    /\b(?:[01]?\d|2[0-3])[:.]\d{2}\b/,
    /\b(?:room|class|course|teacher|prof(?:essor)?|period|semester|timetable|schedule)\b/i,
    /(?:教室|课程|老师|教师|节|学期|课表|周次)/,
  ].filter((pattern) => pattern.test(text)).length;
  const score = usefulCharacters + timetableSignals * 80 + confidence * 2;
  return {
    usefulCharacters,
    timetableSignals,
    score,
    strong:
      usefulCharacters >= MIN_STRONG_TEXT_CHARACTERS &&
      (timetableSignals > 0 || usefulCharacters >= 160),
  };
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

async function preprocessImageVariants(bytes: Uint8Array) {
  const source = sharp(bytes, {
    failOn: "error",
    limitInputPixels: 144_000_000,
    sequentialRead: true,
  }).rotate();
  const metadata = await source.clone().metadata();
  const sourceEdge = Math.max(metadata.width ?? 0, metadata.height ?? 0);
  const targetEdge = Math.min(
    MAX_OCR_EDGE,
    Math.max(MIN_OCR_EDGE, sourceEdge > 0 ? sourceEdge * 2 : MIN_OCR_EDGE),
  );
  const grayscale = await source
    .flatten({ background: "#ffffff" })
    .resize({
      width: targetEdge,
      height: targetEdge,
      fit: "inside",
      withoutEnlargement: false,
    })
    .grayscale()
    .png()
    .toBuffer();
  const stats = await sharp(grayscale).stats();
  const shouldInvert = (stats.channels[0]?.mean ?? 255) < 105;
  const normalized = sharp(grayscale).normalize();
  if (shouldInvert) normalized.negate();
  const normalizedBytes = await normalized
    .sharpen({ sigma: 1 })
    .png()
    .toBuffer();
  const binaryBytes = await sharp(normalizedBytes)
    .threshold(170)
    .png()
    .toBuffer();
  return [
    {
      name: shouldInvert ? "normalized-inverted" : "normalized",
      bytes: normalizedBytes,
    },
    { name: "high-contrast-binary", bytes: binaryBytes },
  ];
}

async function recognizeImage(
  bytes: Uint8Array,
  context: Record<string, unknown>,
) {
  let releaseQueue: (() => void) | undefined;
  const previous = ocrQueue;
  ocrQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });
  await previous;
  try {
    const [worker, variants] = await Promise.all([
      getOcrWorker(),
      preprocessImageVariants(bytes),
    ]);
    let best: OcrResult | null = null;
    for (const [index, variant] of variants.entries()) {
      const result = await worker.recognize(variant.bytes, {
        rotateAuto: true,
      });
      const text = result.data.text.trim();
      const confidence = Number.isFinite(result.data.confidence)
        ? result.data.confidence
        : 0;
      const quality = textQuality(text, confidence);
      logServerEvent("student-hub.schedule-analysis.ocr.attempt.completed", {
        ...context,
        method: variant.name,
        attempt: index + 1,
        characterCount: text.length,
        usefulCharacterCount: quality.usefulCharacters,
        timetableSignalCount: quality.timetableSignals,
        confidence: Math.round(confidence),
      });
      if (!best || quality.score > best.quality.score) {
        best = { text, confidence, method: variant.name, quality };
      }
      if (quality.strong && confidence >= 45) break;
    }
    if (!best || best.quality.usefulCharacters < MIN_USABLE_CHARACTERS) {
      throw new DocumentExtractionError(
        "No readable text was found after automatic rotation, contrast enhancement, resizing, and OCR.",
      );
    }
    return best;
  } catch (error) {
    if (!(error instanceof DocumentExtractionError)) workerPromise = null;
    throw error;
  } finally {
    releaseQueue?.();
  }
}

function pageTextFromItems(items: Array<Record<string, unknown>>) {
  const positioned = items
    .map((item) => {
      const transform = Array.isArray(item.transform) ? item.transform : [];
      return {
        text: typeof item.str === "string" ? item.str.trim() : "",
        x: typeof transform[4] === "number" ? transform[4] : 0,
        y: typeof transform[5] === "number" ? transform[5] : 0,
      };
    })
    .filter((item) => item.text);
  const lines: Array<{ y: number; items: typeof positioned }> = [];
  for (const item of positioned.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 3);
    if (line) line.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) =>
      line.items
        .sort((a, b) => a.x - b.x)
        .map((item) => item.text)
        .join(" "),
    )
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractEmbeddedPdfText(bytes: Uint8Array) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({
    data: Uint8Array.from(bytes),
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
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
      const text = pageTextFromItems(
        content.items as unknown as Array<Record<string, unknown>>,
      );
      logServerEvent(
        "student-hub.schedule-analysis.pdf.embedded-page.completed",
        {
          pageNumber,
          pageCount: document.numPages,
          characterCount: text.length,
        },
      );
      if (text) pages.push(`[Page ${pageNumber}]\n${text}`);
      page.cleanup();
    }
    return { pageCount: document.numPages, text: pages.join("\n\n") };
  } finally {
    await document.destroy();
  }
}

async function extractScannedPdfText(bytes: Uint8Array) {
  const { pdf } = await import("pdf-to-img");
  const document = await pdf(Buffer.from(bytes), {
    scale: 2.8,
    docInitParams: {
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: true,
    },
  });
  try {
    const pageCount = document.length;
    if (pageCount > MAX_PDF_PAGES) {
      throw new DocumentExtractionError(
        `PDF timetables can contain at most ${MAX_PDF_PAGES} pages.`,
      );
    }
    const pages: string[] = [];
    const confidences: number[] = [];
    const warnings: string[] = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      logServerEvent("student-hub.schedule-analysis.ocr.page.started", {
        pageNumber,
        pageCount,
        mimeType: "application/pdf",
      });
      try {
        const result = await recognizeImage(
          await document.getPage(pageNumber),
          {
            pageNumber,
            pageCount,
            mimeType: "application/pdf",
          },
        );
        pages.push(`[Page ${pageNumber}]\n${result.text}`);
        confidences.push(result.confidence);
        if (!result.quality.strong || result.confidence < 45) {
          warnings.push(`OCR confidence was low on PDF page ${pageNumber}.`);
        }
      } catch (error) {
        warnings.push(`PDF page ${pageNumber} could not be read completely.`);
        logServerError("student-hub.schedule-analysis.ocr.page.failed", error, {
          pageNumber,
          pageCount,
          mimeType: "application/pdf",
        });
      }
    }
    return {
      text: pages.join("\n\n"),
      pageCount,
      confidence: confidences.length
        ? confidences.reduce((total, value) => total + value, 0) /
          confidences.length
        : 0,
      warnings,
    };
  } finally {
    await document.destroy();
  }
}

function completedExtraction(input: DocumentTextExtraction, mimeType: string) {
  logServerEvent(
    "student-hub.schedule-analysis.document-extraction.completed",
    {
      mimeType,
      method: input.method,
      pageCount: input.pageCount,
      characterCount: input.characterCount,
      confidence:
        input.confidence === null ? null : Math.round(input.confidence),
      warningCount: input.warnings.length,
      attemptCount: input.attempts.length,
    },
  );
  return input;
}

export async function extractDocumentText(
  bytes: Uint8Array,
  declaredMimeType: string,
): Promise<DocumentTextExtraction> {
  const detectedMimeType = detectDocumentMime(bytes);
  const mimeType = detectedMimeType ?? declaredMimeType.toLowerCase();
  const attempts: string[] = [];
  logServerEvent("student-hub.schedule-analysis.document-extraction.started", {
    declaredMimeType,
    detectedMimeType,
    mimeType,
    sizeBytes: bytes.byteLength,
  });

  if (mimeType === "application/pdf") {
    let embedded: { pageCount: number; text: string } | null = null;
    attempts.push("embedded-pdf-text");
    try {
      embedded = await extractEmbeddedPdfText(bytes);
      const quality = textQuality(embedded.text);
      logServerEvent("student-hub.schedule-analysis.pdf.embedded.completed", {
        pageCount: embedded.pageCount,
        characterCount: embedded.text.length,
        usefulCharacterCount: quality.usefulCharacters,
        timetableSignalCount: quality.timetableSignals,
        usable: quality.strong,
      });
      if (quality.strong) {
        return completedExtraction(
          {
            text: embedded.text,
            method: "embedded-pdf-text",
            pageCount: embedded.pageCount,
            characterCount: embedded.text.length,
            confidence: null,
            warnings: [],
            attempts,
          },
          mimeType,
        );
      }
    } catch (error) {
      if (
        error instanceof DocumentExtractionError &&
        error.message.includes("at most")
      ) {
        throw error;
      }
      logServerError(
        "student-hub.schedule-analysis.pdf.embedded.failed",
        error,
        {
          stage: "embedded-pdf-text",
        },
      );
    }

    attempts.push("rendered-pdf-ocr");
    try {
      const ocr = await extractScannedPdfText(bytes);
      const ocrQuality = textQuality(ocr.text, ocr.confidence);
      const embeddedQuality = textQuality(embedded?.text ?? "");
      if (ocrQuality.usefulCharacters >= MIN_USABLE_CHARACTERS) {
        const combine =
          embeddedQuality.usefulCharacters >= MIN_USABLE_CHARACTERS &&
          embeddedQuality.score > ocrQuality.score * 0.65;
        const text = combine
          ? [
              "[Embedded PDF text]",
              embedded?.text ?? "",
              "[OCR text]",
              ocr.text,
            ].join("\n\n")
          : ocr.text;
        return completedExtraction(
          {
            text,
            method: combine ? "hybrid-pdf-text-ocr" : "pdf-ocr",
            pageCount: ocr.pageCount,
            characterCount: text.length,
            confidence: ocr.confidence,
            warnings: ocr.warnings,
            attempts,
          },
          mimeType,
        );
      }
    } catch (error) {
      logServerError("student-hub.schedule-analysis.pdf.ocr.failed", error, {
        stage: "rendered-pdf-ocr",
      });
      if (
        error instanceof DocumentExtractionError &&
        error.message.includes("at most")
      ) {
        throw error;
      }
    }

    const embeddedQuality = textQuality(embedded?.text ?? "");
    if (embedded && embeddedQuality.usefulCharacters >= MIN_USABLE_CHARACTERS) {
      return completedExtraction(
        {
          text: embedded.text,
          method: "embedded-pdf-text",
          pageCount: embedded.pageCount,
          characterCount: embedded.text.length,
          confidence: null,
          warnings: [
            "Only partial embedded PDF text could be recovered; verify the generated courses carefully.",
          ],
          attempts,
        },
        mimeType,
      );
    }

    throw new DocumentExtractionError(
      "The PDF could not be read after embedded-text extraction and rendered-page OCR were both attempted.",
      true,
      attempts,
    );
  }

  if (
    SUPPORTED_IMAGE_TYPES.includes(
      mimeType as (typeof SUPPORTED_IMAGE_TYPES)[number],
    )
  ) {
    attempts.push("auto-rotate-resize-contrast-ocr");
    try {
      const result = await recognizeImage(bytes, {
        pageNumber: 1,
        pageCount: 1,
        mimeType,
      });
      const warnings =
        result.quality.strong && result.confidence >= 45
          ? []
          : [
              "Some image text was uncertain; verify the generated courses carefully.",
            ];
      return completedExtraction(
        {
          text: result.text,
          method: "image-ocr",
          pageCount: 1,
          characterCount: result.text.length,
          confidence: result.confidence,
          warnings,
          attempts: [...attempts, result.method],
        },
        mimeType,
      );
    } catch (error) {
      logServerError("student-hub.schedule-analysis.image.ocr.failed", error, {
        mimeType,
        stage: "auto-rotate-resize-contrast-ocr",
      });
      if (error instanceof DocumentExtractionError) {
        throw new DocumentExtractionError(error.message, false, attempts);
      }
      throw new DocumentExtractionError(
        "The image could not be decoded or read after automatic enhancement and OCR.",
        true,
        attempts,
      );
    }
  }

  throw new DocumentExtractionError(
    "This timetable file type is not supported.",
    false,
    attempts,
  );
}

export async function disposeDocumentOcrWorker() {
  const activeWorker = workerPromise;
  workerPromise = null;
  if (activeWorker) {
    await (await activeWorker).terminate();
  }
}
