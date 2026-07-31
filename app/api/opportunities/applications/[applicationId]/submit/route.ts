import { NextRequest } from "next/server";
import { submitApplicationSchema } from "@/features/opportunities/schemas";
import { submitApplication } from "@/lib/opportunity-applications";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { rateLimit } from "@/lib/rate-limit";
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
    if (
      !(await rateLimit(`opportunity-submit:${user.id}`, 20, 60 * 60_000))
        .allowed
    ) {
      return jsonError("Too many submissions. Try again later.", 429);
    }
    const body = submitApplicationSchema.parse(await request.json());
    // The deadline, duplicate and requirement checks all run inside the
    // service transaction; nothing here is authoritative.
    return Response.json(
      await submitApplication({
        userId: user.id,
        applicationId: (await params).applicationId,
        consentAccepted: body.consentAccepted,
      }),
    );
  } catch (error) {
    return opportunityApiFailure("opportunities.applications.submit", error);
  }
}
