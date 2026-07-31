import { NextRequest } from "next/server";
import { withdrawApplication } from "@/lib/opportunity-applications";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ applicationId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    if (!hasTrustedOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    return Response.json(
      await withdrawApplication({
        userId: user.id,
        applicationId: (await params).applicationId,
      }),
    );
  } catch (error) {
    return opportunityApiFailure("opportunities.applications.withdraw", error);
  }
}
