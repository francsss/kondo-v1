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
  return null;
}

function contentSafetyScan(bytes: Uint8Array, detectedMime: string) {
  const text = new TextDecoder("latin1").decode(bytes);
  if (text.includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")) {
    throw new MediaPolicyError("The file failed the content safety scan.");
  }
  if (
    detectedMime === "application/pdf" &&
    ["/JavaScript", "/JS", "/Launch", "/EmbeddedFile"].some((marker) =>
      text.includes(marker),
    )
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
  if (!detectedMime || detectedMime !== input.declaredMime) {
    throw new MediaPolicyError(
      "The uploaded file content does not match its declared MIME type.",
    );
  }
  if (!policy.mimeExtensions[detectedMime]?.includes(input.extension)) {
    throw new MediaPolicyError(
      "The uploaded file content does not match its extension.",
    );
  }
  contentSafetyScan(input.bytes, detectedMime);

  let width: number | null = null;
  let height: number | null = null;
  if (policy.kind === "IMAGE") {
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
  } else {
    const tail = new TextDecoder("latin1").decode(input.bytes.slice(-2048));
    if (!tail.includes("%%EOF")) {
      throw new MediaPolicyError("The PDF file is incomplete or invalid.");
    }
  }

  return {
    detectedMime,
    width,
    height,
    checksumSha256: createHash("sha256").update(input.bytes).digest("hex"),
  };
}
