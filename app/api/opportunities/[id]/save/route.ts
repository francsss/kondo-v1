import { NextRequest } from "next/server";
import { saveOpportunitySchema } from "@/features/opportunities/schemas";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { saveOpportunity, unsaveOpportunity } from "@/lib/opportunity-saved";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string }> };

async function actor(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    throw Object.assign(new Error("Invalid request origin."), { status: 403 });
  const user = await getCurrentUser();
  if (!user)
    throw Object.assign(new Error("Authentication required."), { status: 401 });
  return user;
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const user = await actor(request);
    const body = saveOpportunitySchema.parse(
      await request.json().catch(() => ({})),
    );
    return Response.json(
      await saveOpportunity({
        userId: user.id,
        opportunityId: (await params).id,
        remindBeforeDays: body.remindBeforeDays ?? null,
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      return jsonError(error.message, Number(error.status));
    }
    return opportunityApiFailure("opportunities.save", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const user = await actor(request);
    return Response.json(
      await unsaveOpportunity({
        userId: user.id,
        opportunityId: (await params).id,
      }),
    );
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      return jsonError(error.message, Number(error.status));
    }
    return opportunityApiFailure("opportunities.unsave", error);
  }
}
