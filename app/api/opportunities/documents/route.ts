import { NextRequest } from "next/server";
import { opportunityDocumentSchema } from "@/features/opportunities/schemas";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import {
  createUserOpportunityDocument,
  listUserOpportunityDocuments,
} from "@/lib/opportunity-documents";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    return Response.json({
      items: await listUserOpportunityDocuments(user.id),
    });
  } catch (error) {
    return opportunityApiFailure("opportunities.documents.list", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasTrustedOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const body = opportunityDocumentSchema.parse(await request.json());
    return Response.json(
      await createUserOpportunityDocument({ userId: user.id, ...body }),
      { status: 201 },
    );
  } catch (error) {
    return opportunityApiFailure("opportunities.documents.create", error);
  }
}
