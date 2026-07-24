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

  it("reports upload progress and prevents completion before storage succeeds", async () => {
    const progress: number[] = [];
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          media: { id: "media-3" },
          upload: {
            url: "/api/media/uploads/media-3/content",
            method: "PUT",
            headers: { "Content-Type": "image/png" },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ media: { id: "media-3" } }));
    class FakeXMLHttpRequest {
      status = 204;
      responseText = "";
      withCredentials = false;
      upload = {
        addEventListener: (
          type: string,
          listener: (event: ProgressEvent) => void,
        ) => {
          if (type === "progress") {
            listener({
              lengthComputable: true,
              loaded: 1,
              total: 2,
            } as ProgressEvent);
          }
        },
      };
      private listeners = new Map<string, () => void>();
      open() {}
      setRequestHeader() {}
      addEventListener(type: string, listener: () => void) {
        this.listeners.set(type, listener);
      }
      send() {
        this.listeners.get("load")?.();
      }
      abort() {
        this.listeners.get("abort")?.();
      }
    }
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);

    await expect(
      uploadMediaFile(file, {
        purpose: "SCHEDULE_IMPORT",
        onProgress: (value) => progress.push(value),
      }),
    ).resolves.toBe("media-3");

    expect(progress[0]).toBe(2);
    expect(progress).toContain(48);
    expect(progress.at(-1)).toBe(100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
