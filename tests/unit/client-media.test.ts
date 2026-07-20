import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadMediaFile } from "@/lib/client-media";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser media upload pipeline", () => {
  const file = {
    name: "campus.png",
    size: 2048,
    type: "image/png",
  } as File;

  it("authorizes, uploads directly, and completes a media file", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          media: { id: "media-1" },
          upload: {
            url: "https://example.r2.cloudflarestorage.com/object",
            method: "PUT",
            headers: { "Content-Type": "image/png" },
          },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ media: { id: "media-1" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadMediaFile(file, {
        purpose: "PROFILE_AVATAR",
        altText: "Student portrait",
        replacesId: "old-avatar",
      }),
    ).resolves.toBe("media-1");

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.r2.cloudflarestorage.com/object",
      expect.objectContaining({
        method: "PUT",
        credentials: "omit",
        headers: { "Content-Type": "image/png" },
        body: file,
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/media/uploads/media-1/complete",
      { method: "POST", credentials: "include" },
    );
  });

  it("reports a storage network failure and never marks the upload complete", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          media: { id: "media-2" },
          upload: {
            url: "https://example.r2.cloudflarestorage.com/object",
            method: "PUT",
            headers: { "Content-Type": "image/png" },
          },
        }),
      )
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadMediaFile(file, {
        purpose: "POST_IMAGE",
        altText: "Campus courtyard",
      }),
    ).rejects.toThrow("Could not reach media storage");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
