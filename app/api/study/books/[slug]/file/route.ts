import { NextRequest } from "next/server";
import { internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { readStudyAssetBytes } from "@/lib/study-asset-access";
import { StudyEssentialError } from "@/lib/study-essentials";

/**
 * Stream a book to a reader that is entitled to it.
 *
 * Used where object storage issues no signed URLs. The session and the
 * entitlement are checked on this request, not inherited from an earlier one,
 * and nothing here is cacheable — a shared cache holding a book would be the
 * permanent public URL the whole design avoids.
 */

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  try {
    const { bytes, contentType } = await readStudyAssetBytes({
      userId: user.id,
      slug: (await params).slug,
    });
    return new Response(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "Cookie",
      },
    });
  } catch (error) {
    if (error instanceof StudyEssentialError)
      return jsonError(error.message, error.status);
    return internalApiError("study.book.file", error);
  }
}
