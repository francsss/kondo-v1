import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { MediaPolicyError, validateMediaIntent } from "@/lib/media-policy";
import {
  createMediaUploadToken,
  verifyMediaUploadToken,
} from "@/lib/media-token";
import {
  detectMediaMime,
  detectMp4DurationSeconds,
  validateUploadedMedia,
} from "@/lib/media-validation";

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

  it("validates Student Story media intent and MP4 duration metadata", () => {
    expect(
      validateMediaIntent({
        purpose: "STORY_VIDEO",
        fileName: "student-life.mp4",
        mimeType: "video/mp4",
        sizeBytes: 5_000_000,
      }),
    ).toMatchObject({
      kind: "VIDEO",
      policy: { visibility: "PUBLIC", maxBytes: 25 * 1024 * 1024 },
    });
    expect(
      validateMediaIntent({
        purpose: "STORY_VIDEO",
        fileName: "iphone-story.mov",
        mimeType: "video/quicktime",
        sizeBytes: 8_000_000,
      }),
    ).toMatchObject({ kind: "VIDEO" });
    expect(
      validateMediaIntent({
        purpose: "STORY_VIDEO",
        fileName: "android-story.m4v",
        mimeType: "video/x-m4v",
        sizeBytes: 8_000_000,
      }),
    ).toMatchObject({ kind: "VIDEO" });
    expect(
      validateMediaIntent({
        purpose: "VERIFICATION_DOCUMENT",
        fileName: "authority.pdf",
        mimeType: "application/pdf",
        sizeBytes: 500_000,
      }),
    ).toMatchObject({
      kind: "DOCUMENT",
      policy: { visibility: "PRIVATE" },
    });

    const bytes = new Uint8Array(32);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 32);
    bytes.set(new TextEncoder().encode("mvhd"), 4);
    view.setUint32(20, 1_000);
    view.setUint32(24, 179_500);
    expect(detectMp4DurationSeconds(bytes)).toBe(180);

    view.setUint32(20, 0);
    expect(detectMp4DurationSeconds(bytes)).toBeNull();
  });
});

/**
 * Voice notes are WebM, and so is video. The EBML magic alone cannot tell them
 * apart, so the container header is read — and it has to be read only as far
 * as the first Cluster, because the encoded frames after it will eventually
 * contain the same three bytes by chance.
 */
describe("WebM audio detection", () => {
  const EBML = [0x1a, 0x45, 0xdf, 0xa3];
  const CLUSTER = [0x1f, 0x43, 0xb6, 0x75];
  /** TrackType (0x83), one byte long (0x81), then 1 = video or 2 = audio. */
  const trackType = (value: number) => [0x83, 0x81, value];

  const webm = (...parts: number[][]) => new Uint8Array(parts.flat());
  const padding = Array.from({ length: 16 }, (_, index) => index);

  it("reads an audio-only track as audio", () => {
    expect(detectMediaMime(webm(EBML, padding, trackType(2)))).toBe(
      "audio/webm",
    );
  });

  it("reads a file carrying video as video, whichever track comes first", () => {
    expect(detectMediaMime(webm(EBML, padding, trackType(1)))).toBe(
      "video/webm",
    );
    expect(
      detectMediaMime(webm(EBML, padding, trackType(2), padding, trackType(1))),
    ).toBe("video/webm");
  });

  it("ignores track markers that appear after the first cluster", () => {
    // Frame bytes are not track declarations. Trusting them would let encoded
    // audio be read out of a video file.
    expect(
      detectMediaMime(webm(EBML, padding, CLUSTER, padding, trackType(2))),
    ).toBeNull();
  });

  it("rejects an EBML file that declares no track at all", () => {
    expect(detectMediaMime(webm(EBML, padding))).toBeNull();
  });

  it("accepts a recorded voice note and refuses one that is really video", async () => {
    const audio = webm(EBML, padding, trackType(2));
    await expect(
      validateUploadedMedia({
        purpose: "COURSE_CAPTURE_AUDIO",
        bytes: audio,
        declaredMime: "audio/webm",
        extension: "webm",
        expectedSizeBytes: audio.byteLength,
      }),
    ).resolves.toMatchObject({ detectedMime: "audio/webm" });

    const video = webm(EBML, padding, trackType(1));
    await expect(
      validateUploadedMedia({
        purpose: "COURSE_CAPTURE_AUDIO",
        bytes: video,
        declaredMime: "audio/webm",
        extension: "webm",
        expectedSizeBytes: video.byteLength,
      }),
    ).rejects.toBeInstanceOf(MediaPolicyError);
  });
});
