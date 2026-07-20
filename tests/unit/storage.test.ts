import { afterEach, describe, expect, it, vi } from "vitest";
import { getObjectStorage, isStorageObjectNotFound } from "@/lib/storage";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("S3 object storage signing", () => {
  function useR2Configuration() {
    vi.stubEnv("STORAGE_DRIVER", "s3");
    vi.stubEnv("STORAGE_BUCKET", "kondo-test");
    vi.stubEnv("STORAGE_REGION", "auto");
    vi.stubEnv(
      "STORAGE_ENDPOINT",
      "https://example-account.r2.cloudflarestorage.com",
    );
    vi.stubEnv("STORAGE_ACCESS_KEY_ID", "test-access-key");
    vi.stubEnv("STORAGE_SECRET_ACCESS_KEY", "test-secret-key");
  }

  it("does not sign an empty-body CRC32 into browser PUT URLs", async () => {
    useR2Configuration();
    const target = await getObjectStorage().createUploadTarget({
      assetId: "asset-1",
      objectKey: "media/member/post/image.png",
      contentType: "image/png",
      sizeBytes: 2048,
      uploadToken: "unused-for-s3",
      expiresAt: new Date(Date.now() + 5 * 60_000),
    });
    const queryNames = [...new URL(target.url).searchParams.keys()].map((key) =>
      key.toLowerCase(),
    );

    expect(queryNames).not.toContain("x-amz-checksum-crc32");
    expect(queryNames).not.toContain("x-amz-sdk-checksum-algorithm");
    expect(target.headers).toEqual({ "Content-Type": "image/png" });
  });

  it("creates a short-lived signed GET rather than proxying S3 bytes", async () => {
    useR2Configuration();
    const target = await getObjectStorage().createReadTarget({
      objectKey: "media/member/post/image.png",
      contentType: "image/png",
      contentDisposition: "inline; filename*=UTF-8''image.png",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const url = new URL(target?.url ?? "");

    expect(url.hostname).toBe("example-account.r2.cloudflarestorage.com");
    expect(url.searchParams.get("response-content-type")).toBe("image/png");
    expect(url.searchParams.get("response-content-disposition")).toContain(
      "inline",
    );
  });
});

describe("storage error classification", () => {
  it("recognizes local and S3 missing-object errors", () => {
    expect(
      isStorageObjectNotFound(
        Object.assign(new Error("missing"), { code: "ENOENT" }),
      ),
    ).toBe(true);
    expect(
      isStorageObjectNotFound(
        Object.assign(new Error("missing"), {
          name: "NoSuchKey",
          $metadata: { httpStatusCode: 404 },
        }),
      ),
    ).toBe(true);
    expect(isStorageObjectNotFound(new Error("provider timeout"))).toBe(false);
  });
});
