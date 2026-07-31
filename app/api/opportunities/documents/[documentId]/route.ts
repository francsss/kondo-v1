import { NextRequest } from "next/server";
import { archiveUserOpportunityDocument } from "@/lib/opportunity-documents";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ documentId: string }> };

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    if (!hasTrustedOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    return Response.json(
      await archiveUserOpportunityDocument({
        userId: user.id,
        documentId: (await params).documentId,
      }),
    );
  } catch (error) {
    return opportunityApiFailure("opportunities.documents.delete", error);
  }
}
