import { NextRequest } from "next/server";
import { assignApplicationReviewer } from "@/lib/opportunity-application-review";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string; applicationId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    if (!hasTrustedOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const body = (await request.json()) as { reviewerUserId?: string | null };
    const { id, applicationId } = await params;
    return Response.json(
      await assignApplicationReviewer({
        userId: user.id,
        organizationId: id,
        applicationId,
        reviewerUserId: body.reviewerUserId ?? null,
      }),
    );
  } catch (error) {
    return opportunityApiFailure("organizations.applications.assign", error);
  }
}
