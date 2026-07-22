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
  },
) {
  const intentResponse = await fetch("/api/media/uploads", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
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

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(intent.upload.url, {
      method: intent.upload.method,
      credentials: intent.upload.url.startsWith("/") ? "include" : "omit",
      headers: intent.upload.headers,
      body: file,
    });
  } catch {
    throw new Error(
      "Could not reach media storage. Check your connection and try again.",
    );
  }
  if (!uploadResponse.ok) {
    const payload = await uploadResponse.json().catch(() => null);
    throw new Error(payload?.error ?? "Could not upload the file.");
  }

  const completeResponse = await fetch(
    `/api/media/uploads/${intent.media.id}/complete`,
    { method: "POST", credentials: "include" },
  );
  const completed = await completeResponse.json().catch(() => null);
  if (!completeResponse.ok) {
    throw new Error(completed?.error ?? "Could not validate the file.");
  }
  return completed?.media?.id ?? intent.media.id;
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
