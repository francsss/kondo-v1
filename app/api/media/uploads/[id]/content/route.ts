import { NextRequest } from "next/server";
import { MediaError, receiveLocalMediaUpload } from "@/lib/media";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const lengthHeader = request.headers.get("content-length");
  const contentLength = lengthHeader ? Number(lengthHeader) : null;
  if (
    contentLength === null ||
    !Number.isSafeInteger(contentLength) ||
    contentLength <= 0 ||
    contentLength > MAX_UPLOAD_BYTES
  ) {
    return jsonError("A valid Content-Length header is required.", 400);
  }

  try {
    const bytes = new Uint8Array(await request.arrayBuffer());
    await receiveLocalMediaUpload({
      assetId: (await params).id,
      uploadToken: request.headers.get("x-kondo-upload-token"),
      contentType: request.headers.get("content-type"),
      contentLength,
      bytes,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof MediaError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("media.upload.local", error);
  }
}
