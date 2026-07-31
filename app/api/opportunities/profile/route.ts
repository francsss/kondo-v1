import { NextRequest } from "next/server";
import { opportunityProfileSchema } from "@/features/opportunities/schemas";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const profile = await prisma.userOpportunityProfile.findUnique({
      where: { userId: user.id },
    });
    return Response.json(
      profile ?? { userId: user.id, recommendationsEnabled: false },
    );
  } catch (error) {
    return opportunityApiFailure("opportunities.profile.get", error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!hasTrustedOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const body = opportunityProfileSchema.parse(await request.json());
    const saved = await prisma.userOpportunityProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...body },
      update: body,
    });
    return Response.json(saved);
  } catch (error) {
    return opportunityApiFailure("opportunities.profile.update", error);
  }
}
