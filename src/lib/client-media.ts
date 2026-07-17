type UploadIntent = {
  media: { id: string };
  upload: {
    url: string;
    method: "PUT";
    headers: Record<string, string>;
  };
};

export async function uploadPublicImage(
  file: File,
  purpose: "COMMUNITY_COVER" | "POST_IMAGE" | "LISTING_IMAGE",
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
  const intentResponse = await fetch("/api/media/uploads", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      purpose,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      altText: altText.trim(),
    }),
  });
  const intent = (await intentResponse.json().catch(() => null)) as
    | UploadIntent
    | { error?: string }
    | null;
  if (!intentResponse.ok || !intent || !("upload" in intent)) {
    throw new Error(
      intent && "error" in intent && intent.error
        ? intent.error
        : "Could not authorize the image.",
    );
  }
  const uploadResponse = await fetch(intent.upload.url, {
    method: intent.upload.method,
    credentials: intent.upload.url.startsWith("/") ? "include" : "omit",
    headers: intent.upload.headers,
    body: file,
  });
  if (!uploadResponse.ok) {
    const payload = await uploadResponse.json().catch(() => null);
    throw new Error(payload?.error ?? "Could not upload the image.");
  }
  const completeResponse = await fetch(
    `/api/media/uploads/${intent.media.id}/complete`,
    { method: "POST", credentials: "include" },
  );
  const complete = await completeResponse.json().catch(() => null);
  if (!completeResponse.ok) {
    throw new Error(complete?.error ?? "Could not validate the image.");
  }
  return intent.media.id;
}
