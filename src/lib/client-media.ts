type UploadIntent = {
  media: { id: string };
  upload: {
    url: string;
    method: "PUT";
    headers: Record<string, string>;
  };
};

type MediaPurpose =
  | "PROFILE_AVATAR"
  | "COMMUNITY_COVER"
  | "GUIDE_COVER"
  | "POST_IMAGE"
  | "LISTING_IMAGE"
  | "MESSAGE_IMAGE"
  | "MESSAGE_DOCUMENT"
  | "SCHEDULE_IMPORT";

export async function uploadMediaFile(
  file: File,
  input: {
    purpose: MediaPurpose;
    altText?: string;
    replacesId?: string;
    onProgress?: (progress: number) => void;
    signal?: AbortSignal;
  },
) {
  input.onProgress?.(2);
  const intentResponse = await fetch("/api/media/uploads", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    signal: input.signal,
    body: JSON.stringify({
      purpose: input.purpose,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      ...(input.altText ? { altText: input.altText } : {}),
      ...(input.replacesId ? { replacesId: input.replacesId } : {}),
    }),
  });
  const intent = (await intentResponse.json().catch(() => null)) as
    UploadIntent | { error?: string } | null;
  if (!intentResponse.ok || !intent || !("upload" in intent)) {
    throw new Error(
      intent && "error" in intent && intent.error
        ? intent.error
        : "Could not authorize the file.",
    );
  }

  input.onProgress?.(5);
  await uploadFileBytes(file, intent.upload, input);

  input.onProgress?.(92);
  const completeResponse = await fetch(
    `/api/media/uploads/${intent.media.id}/complete`,
    {
      method: "POST",
      credentials: "include",
      signal: input.signal,
    },
  );
  const completed = await completeResponse.json().catch(() => null);
  if (!completeResponse.ok) {
    throw new Error(completed?.error ?? "Could not validate the file.");
  }
  input.onProgress?.(100);
  return completed?.media?.id ?? intent.media.id;
}

async function uploadFileBytes(
  file: File,
  upload: UploadIntent["upload"],
  input: {
    onProgress?: (progress: number) => void;
    signal?: AbortSignal;
  },
) {
  if (input.onProgress && typeof XMLHttpRequest !== "undefined") {
    await new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();
      const abort = () => request.abort();
      request.open(upload.method, upload.url);
      request.withCredentials = upload.url.startsWith("/");
      for (const [name, value] of Object.entries(upload.headers)) {
        request.setRequestHeader(name, value);
      }
      request.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        input.onProgress?.(
          Math.min(90, 5 + Math.round((event.loaded / event.total) * 85)),
        );
      });
      request.addEventListener("load", () => {
        input.signal?.removeEventListener("abort", abort);
        if (request.status >= 200 && request.status < 300) {
          resolve();
          return;
        }
        let message = "Could not upload the file.";
        try {
          const payload = JSON.parse(request.responseText) as {
            error?: string;
          };
          if (payload.error) message = payload.error;
        } catch {
          // Storage providers may return an empty or non-JSON error response.
        }
        reject(new Error(message));
      });
      request.addEventListener("error", () => {
        input.signal?.removeEventListener("abort", abort);
        reject(
          new Error(
            "Could not reach media storage. Check your connection and try again.",
          ),
        );
      });
      request.addEventListener("abort", () => {
        input.signal?.removeEventListener("abort", abort);
        reject(new DOMException("The upload was cancelled.", "AbortError"));
      });
      if (input.signal?.aborted) {
        reject(new DOMException("The upload was cancelled.", "AbortError"));
        return;
      }
      input.signal?.addEventListener("abort", abort, { once: true });
      request.send(file);
    });
    return;
  }

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(upload.url, {
      method: upload.method,
      credentials: upload.url.startsWith("/") ? "include" : "omit",
      headers: upload.headers,
      body: file,
      signal: input.signal,
    });
  } catch (error) {
    if (input.signal?.aborted) throw error;
    throw new Error(
      "Could not reach media storage. Check your connection and try again.",
    );
  }
  if (!uploadResponse.ok) {
    const payload = await uploadResponse.json().catch(() => null);
    throw new Error(payload?.error ?? "Could not upload the file.");
  }
}

export async function uploadPublicImage(
  file: File,
  purpose: "COMMUNITY_COVER" | "GUIDE_COVER" | "POST_IMAGE" | "LISTING_IMAGE",
  altText: string,
) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Images must be 8 MB or smaller.");
  }
  if (altText.trim().length < 2) {
    throw new Error("Add a short image description.");
  }
  return uploadMediaFile(file, {
    purpose,
    altText: altText.trim(),
  });
}
