import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { MediaPolicyError, validateMediaIntent } from "@/lib/media-policy";
import {
  createMediaUploadToken,
  verifyMediaUploadToken,
} from "@/lib/media-token";
import { detectMediaMime, validateUploadedMedia } from "@/lib/media-validation";

describe("media security primitives", () => {
  it("requires matching extensions, MIME policy, size limits, and alt text", () => {
    expect(() =>
      validateMediaIntent({
        purpose: "PROFILE_AVATAR",
        fileName: "portrait.png",
        mimeType: "image/jpeg",
        sizeBytes: 1000,
        altText: "Member portrait",
      }),
    ).toThrow(MediaPolicyError);
    expect(() =>
      validateMediaIntent({
        purpose: "PROFILE_AVATAR",
        fileName: "portrait.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1000,
        altText: "",
      }),
    ).toThrow(MediaPolicyError);
    expect(() =>
      validateMediaIntent({
        purpose: "MESSAGE_DOCUMENT",
        fileName: "document.pdf",
        mimeType: "application/pdf",
        sizeBytes: 11 * 1024 * 1024,
      }),
    ).toThrow(MediaPolicyError);
  });

  it("signs upload authorization claims and rejects tampering", async () => {
    const input = {
      assetId: "cm12345678901234567890123",
      ownerId: "cm12345678901234567890124",
      objectKey: "media/owner/avatar.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1234,
    };
    const token = await createMediaUploadToken(input);
    await expect(verifyMediaUploadToken(token)).resolves.toEqual(input);
    const parts = token.split(".");
    parts[1] = `${parts[1]?.startsWith("a") ? "b" : "a"}${parts[1]?.slice(1)}`;
    await expect(verifyMediaUploadToken(parts.join("."))).resolves.toBeNull();
  });

  it("detects and fully decodes a valid image with its dimensions", async () => {
    const bytes = new Uint8Array(
      await sharp({
        create: {
          width: 256,
          height: 256,
          channels: 3,
          background: "#16a34a",
        },
      })
        .jpeg()
        .toBuffer(),
    );
    expect(detectMediaMime(bytes)).toBe("image/jpeg");
    await expect(
      validateUploadedMedia({
        purpose: "PROFILE_AVATAR",
        bytes,
        declaredMime: "image/jpeg",
        extension: "jpg",
        expectedSizeBytes: bytes.byteLength,
      }),
    ).resolves.toMatchObject({
      detectedMime: "image/jpeg",
      width: 256,
      height: 256,
      checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("rejects MIME spoofing and active PDF content", async () => {
    const scriptedPdf = new TextEncoder().encode(
      "%PDF-1.7\n1 0 obj\n<< /JavaScript (alert) >>\nendobj\n%%EOF",
    );
    await expect(
      validateUploadedMedia({
        purpose: "MESSAGE_DOCUMENT",
        bytes: scriptedPdf,
        declaredMime: "application/pdf",
        extension: "pdf",
        expectedSizeBytes: scriptedPdf.byteLength,
      }),
    ).rejects.toThrow("scripts, launch actions");

    await expect(
      validateUploadedMedia({
        purpose: "PROFILE_AVATAR",
        bytes: scriptedPdf,
        declaredMime: "image/jpeg",
        extension: "jpg",
        expectedSizeBytes: scriptedPdf.byteLength,
      }),
    ).rejects.toThrow("does not match its declared MIME");
  });

  it("does not treat compressed PDF stream bytes as active actions", async () => {
    const safePdfWithBinaryMarker = new TextEncoder().encode(
      "%PDF-1.7\n1 0 obj\n<< /Length 5 >>\nstream\n6#/JS\nendstream\nendobj\n%%EOF",
    );
    await expect(
      validateUploadedMedia({
        purpose: "SCHEDULE_IMPORT",
        bytes: safePdfWithBinaryMarker,
        declaredMime: "application/pdf",
        extension: "pdf",
        expectedSizeBytes: safePdfWithBinaryMarker.byteLength,
      }),
    ).resolves.toMatchObject({ detectedMime: "application/pdf" });
  });

  it("accepts private timetable images and safe PDFs under the schedule limits", async () => {
    expect(
      validateMediaIntent({
        purpose: "SCHEDULE_IMPORT",
        fileName: "timetable.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2_000_000,
      }),
    ).toMatchObject({ kind: "DOCUMENT", policy: { visibility: "PRIVATE" } });
    expect(
      validateMediaIntent({
        purpose: "SCHEDULE_IMPORT",
        fileName: "课表.png",
        mimeType: "image/png",
        sizeBytes: 2_000_000,
      }),
    ).toMatchObject({ kind: "IMAGE", policy: { visibility: "PRIVATE" } });
  });
});
