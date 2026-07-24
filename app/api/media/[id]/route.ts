import { NextRequest } from "next/server";
import {
  getMediaForDelivery,
  MediaError,
  removeOwnedMedia,
  updateMediaAltText,
} from "@/lib/media";
import {
  getObjectStorageForProvider,
  isStorageObjectNotFound,
} from "@/lib/storage";
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
    const storage = getObjectStorageForProvider(media.storageProvider);
    const isPublic = media.visibility === "PUBLIC";
    const disposition =
      media.kind === "IMAGE" || media.kind === "VIDEO"
        ? "inline"
        : "attachment";
    const contentType = media.detectedMime ?? "application/octet-stream";
    const contentDisposition = `${disposition}; filename*=UTF-8''${encodeURIComponent(media.originalFileName)}`;
    const readTarget = await storage.createReadTarget({
      objectKey: media.objectKey,
      contentType,
      contentDisposition,
      expiresAt: new Date(Date.now() + 60_000),
    });
    if (readTarget) {
      return new Response(null, {
        status: 307,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Location: readTarget.url,
          "Referrer-Policy": "no-referrer",
          Vary: "Cookie",
        },
      });
    }
    let bytes: Uint8Array;
    try {
      bytes = await storage.read(media.objectKey);
    } catch (error) {
      if (isStorageObjectNotFound(error)) {
        throw new MediaError("Media not found.", 404);
      }
      throw error;
    }
    const body = Uint8Array.from(bytes).buffer;
    return new Response(body, {
      headers: {
        "Cache-Control": isPublic
          ? "public, max-age=300, stale-while-revalidate=60"
          : "private, no-store, max-age=0",
        "Content-Disposition": contentDisposition,
        "Content-Length": String(bytes.byteLength),
        "Content-Security-Policy":
          media.kind === "DOCUMENT"
            ? "sandbox; default-src 'none'"
            : "default-src 'none'",
        "Content-Type": contentType,
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
