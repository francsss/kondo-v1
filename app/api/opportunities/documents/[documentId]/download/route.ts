import { NextRequest } from "next/server";
import { authorizeDocumentAccess } from "@/lib/opportunity-documents";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ documentId: string }> };

// Private application documents are never statically cached and never served
// from a public URL. Authorization is re-checked on every request.
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const access = await authorizeDocumentAccess({
      viewerUserId: user.id,
      documentId: (await params).documentId,
    });
    // Delivery is delegated to the existing private media route, which applies
    // the media pipeline's own scan-state and visibility rules.
    return Response.json(
      { mediaId: access.mediaId, url: `/api/media/${access.mediaId}` },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return opportunityApiFailure("opportunities.documents.download", error);
  }
}
