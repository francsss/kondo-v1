import { createHash } from "node:crypto";
import type { MediaPurpose } from "@prisma/client";
import sharp from "sharp";
import { MEDIA_POLICIES, MediaPolicyError } from "@/lib/media-policy";

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export function detectMediaMime(bytes: Uint8Array) {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  if (new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") {
    return "application/pdf";
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return detectWebmMime(bytes);
  if (
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp"
  ) {
    const brand = new TextDecoder("latin1").decode(bytes.slice(8, 12));
    if (brand === "qt  ") return "video/quicktime";
    if (/^M4V/i.test(brand)) return "video/x-m4v";
    return "video/mp4";
  }
  return null;
}

/**
 * Tell an audio-only WebM from one carrying video.
 *
 * The EBML magic is shared by both, so the container header has to be read.
 * `TrackType` (element id `0x83`) is a one-byte value inside each
 * `TrackEntry`: 1 is video, 2 is audio. Both live in `Tracks`, which
 * `MediaRecorder` writes before the first `Cluster`, so the search stops
 * there — that keeps it away from the encoded frames, where the same three
 * bytes would turn up by chance.
 *
 * Anything that is neither is rejected by returning null, which
 * `validateUploadedMedia` treats as a content/MIME mismatch.
 */
function detectWebmMime(bytes: Uint8Array) {
  const cluster = [0x1f, 0x43, 0xb6, 0x75];
  let limit = Math.min(bytes.length, 65_536);
  for (let index = 4; index <= limit - cluster.length; index += 1) {
    if (cluster.every((value, offset) => bytes[index + offset] === value)) {
      limit = index;
      break;
    }
  }
  let audio = false;
  for (let index = 4; index <= limit - 3; index += 1) {
    if (bytes[index] !== 0x83 || bytes[index + 1] !== 0x81) continue;
    if (bytes[index + 2] === 0x01) return "video/webm";
    if (bytes[index + 2] === 0x02) audio = true;
  }
  return audio ? "audio/webm" : null;
}

function readUint64(view: DataView, offset: number) {
  const high = view.getUint32(offset);
  const low = view.getUint32(offset + 4);
  return high * 2 ** 32 + low;
}

export function detectMp4DurationSeconds(bytes: Uint8Array) {
  const marker = new TextEncoder().encode("mvhd");
  let markerOffset = -1;
  for (let index = 4; index <= bytes.length - marker.length; index += 1) {
    if (marker.every((value, offset) => bytes[index + offset] === value)) {
      markerOffset = index;
      break;
    }
  }
  if (markerOffset < 4) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const boxStart = markerOffset - 4;
  const boxSize = view.getUint32(boxStart);
  const payload = markerOffset + 4;
  if (boxSize < 28 || boxStart + boxSize > bytes.length) return null;

  const version = view.getUint8(payload);
  const timescaleOffset = version === 1 ? payload + 20 : payload + 12;
  const durationOffset = version === 1 ? payload + 24 : payload + 16;
  const required = durationOffset + (version === 1 ? 8 : 4);
  if (required > boxStart + boxSize || required > bytes.length) return null;
  const timescale = view.getUint32(timescaleOffset);
  const duration =
    version === 1
      ? readUint64(view, durationOffset)
      : view.getUint32(durationOffset);
  if (!timescale || !Number.isFinite(duration)) return null;
  return Math.max(1, Math.ceil(duration / timescale));
}

function contentSafetyScan(bytes: Uint8Array, detectedMime: string) {
  const text = new TextDecoder("latin1").decode(bytes);
  if (text.includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")) {
    throw new MediaPolicyError("The file failed the content safety scan.");
  }
  // PDF stream bodies contain compressed image/font bytes. Scanning those
  // bytes as text creates false positives (for example a harmless JPEG stream
  // can randomly contain "/JS"). Active-action names are meaningful in PDF
  // dictionaries, which live outside stream bodies.
  const pdfStructure =
    detectedMime === "application/pdf"
      ? text.replace(
          /\bstream\r?\n[\s\S]*?\r?\nendstream\b/g,
          "stream endstream",
        )
      : text;
  if (
    detectedMime === "application/pdf" &&
    /\/(?:JavaScript|JS|Launch|EmbeddedFile)\b/.test(pdfStructure)
  ) {
    throw new MediaPolicyError(
      "PDF files with scripts, launch actions, or embedded files are not allowed.",
    );
  }
}

export async function validateUploadedMedia(input: {
  purpose: MediaPurpose;
  bytes: Uint8Array;
  declaredMime: string;
  extension: string;
  expectedSizeBytes: number;
}) {
  const policy = MEDIA_POLICIES[input.purpose];
  if (input.bytes.byteLength !== input.expectedSizeBytes) {
    throw new MediaPolicyError(
      "Uploaded bytes do not match the declared file size.",
    );
  }
  if (input.bytes.byteLength > policy.maxBytes) {
    throw new MediaPolicyError("The uploaded file exceeds the size limit.");
  }
  const detectedMime = detectMediaMime(input.bytes);
  const declaredMime = input.declaredMime.toLowerCase();
  const compatibleVideoDeclaration =
    policy.kind === "VIDEO" &&
    Boolean(detectedMime?.startsWith("video/")) &&
    declaredMime.startsWith("video/") &&
    Boolean(policy.mimeExtensions[declaredMime]?.includes(input.extension));
  if (
    !detectedMime ||
    (detectedMime !== declaredMime && !compatibleVideoDeclaration)
  ) {
    throw new MediaPolicyError(
      "The uploaded file content does not match its declared MIME type.",
    );
  }
  if (
    !policy.mimeExtensions[detectedMime]?.includes(input.extension) &&
    !policy.mimeExtensions[declaredMime]?.includes(input.extension)
  ) {
    throw new MediaPolicyError(
      "The uploaded file content does not match its extension.",
    );
  }
  contentSafetyScan(input.bytes, detectedMime);

  let width: number | null = null;
  let height: number | null = null;
  let durationSeconds: number | null = null;
  if (detectedMime.startsWith("image/")) {
    try {
      const decoder = sharp(input.bytes, {
        failOn: "error",
        limitInputPixels: 40_000_000,
        sequentialRead: true,
      });
      const metadata = await decoder.metadata();
      await decoder.clone().stats();
      width = metadata.width ?? null;
      height = metadata.height ?? null;
      if (!width || !height || (metadata.pages ?? 1) !== 1) {
        throw new MediaPolicyError(
          "The image dimensions or frame count are invalid.",
        );
      }
      if (
        (policy.minWidth && width < policy.minWidth) ||
        (policy.minHeight && height < policy.minHeight) ||
        (policy.maxWidth && width > policy.maxWidth) ||
        (policy.maxHeight && height > policy.maxHeight)
      ) {
        throw new MediaPolicyError(
          "The image dimensions are outside the allowed range.",
        );
      }
    } catch (error) {
      if (error instanceof MediaPolicyError) throw error;
      throw new MediaPolicyError("The image could not be decoded safely.");
    }
  } else if (detectedMime === "application/pdf") {
    const tail = new TextDecoder("latin1").decode(input.bytes.slice(-2048));
    if (!tail.includes("%%EOF")) {
      throw new MediaPolicyError("The PDF file is incomplete or invalid.");
    }
    if (input.purpose === "SCHEDULE_IMPORT") {
      const text = new TextDecoder("latin1").decode(input.bytes);
      const pages = text.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
      if (pages > 10) {
        throw new MediaPolicyError(
          "Schedule PDFs must contain 10 pages or fewer.",
        );
      }
    }
  } else if (detectedMime.startsWith("video/")) {
    durationSeconds = detectMp4DurationSeconds(input.bytes);
    if (!durationSeconds) {
      throw new MediaPolicyError(
        "The video duration could not be verified. Export the video again and retry.",
      );
    }
    if (durationSeconds > 180) {
      throw new MediaPolicyError(
        "Student Stories must be 3 minutes or shorter.",
      );
    }
  }

  return {
    detectedMime,
    width,
    height,
    durationSeconds,
    checksumSha256: createHash("sha256").update(input.bytes).digest("hex"),
  };
}
