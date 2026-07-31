import { NextRequest } from "next/server";
import { z } from "zod";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { setOpportunityCover } from "@/lib/opportunity-media";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

const coverSchema = z.object({
  mediaId: z.string().cuid(),
  altText: z.string().trim().min(3).max(240),
});

type Context = { params: Promise<{ id: string; opportunityId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    if (!hasTrustedOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const body = coverSchema.parse(await request.json());
    const { id, opportunityId } = await params;
    return Response.json(
      await setOpportunityCover({
        userId: user.id,
        organizationId: id,
        opportunityId,
        ...body,
      }),
    );
  } catch (error) {
    return opportunityApiFailure("organizations.opportunities.cover", error);
  }
}
