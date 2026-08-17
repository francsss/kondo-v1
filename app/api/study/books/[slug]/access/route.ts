import { NextRequest } from "next/server";
import { logServerEvent } from "@/lib/logger";
import { internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { createStudyAssetAccess } from "@/lib/study-asset-access";
import { StudyEssentialError } from "@/lib/study-essentials";

/**
 * The only way to reach a book file.
 *
 * Authenticates, checks the entitlement, then returns a signed URL that
 * expires in minutes. The storage key never leaves the server, and nothing
 * here is cacheable — a response held in a shared cache would be exactly the
 * permanent public URL this endpoint exists to avoid.
 */

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  const { slug } = await params;
  try {
    const access = await createStudyAssetAccess({ userId: user.id, slug });
    logServerEvent("study.book.access", { slug });
    return Response.json(access, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "Cookie",
      },
    });
  } catch (error) {
    if (error instanceof StudyEssentialError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("study.book.access", error);
  }
}
