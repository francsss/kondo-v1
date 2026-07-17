import { NextRequest } from "next/server";
import {
  getMediaForDelivery,
  MediaError,
  removeOwnedMedia,
  updateMediaAltText,
} from "@/lib/media";
import { getObjectStorageForProvider } from "@/lib/storage";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { mediaAltTextSchema } from "@/lib/validation";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    const media = await getMediaForDelivery((await params).id, user);
    const bytes = await getObjectStorageForProvider(media.storageProvider).read(
      media.objectKey,
    );
    const isPublic = media.visibility === "PUBLIC";
    const disposition = media.kind === "IMAGE" ? "inline" : "attachment";
    const body = Uint8Array.from(bytes).buffer;
    return new Response(body, {
      headers: {
        "Cache-Control": isPublic
          ? "public, max-age=300, stale-while-revalidate=60"
          : "private, no-store, max-age=0",
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(media.originalFileName)}`,
        "Content-Length": String(bytes.byteLength),
        "Content-Security-Policy":
          media.kind === "DOCUMENT"
            ? "sandbox; default-src 'none'"
            : "default-src 'none'",
        "Content-Type": media.detectedMime ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        Vary: "Cookie",
      },
    });
  } catch (error) {
    if (error instanceof MediaError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("media.delivery", error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = mediaAltTextSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid alt text.");
  }
  try {
    const media = await updateMediaAltText(
      user,
      (await params).id,
      parsed.data.altText,
      getRequestMeta(request),
    );
    return Response.json({ media });
  } catch (error) {
    if (error instanceof MediaError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("media.alt-text", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    return Response.json(
      await removeOwnedMedia(user, (await params).id, getRequestMeta(request)),
    );
  } catch (error) {
    if (error instanceof MediaError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("media.remove.owner", error);
  }
}
