import { NextRequest } from "next/server";
import { organizationApiFailure } from "@/lib/organization-api";
import { createOwnershipTransfer } from "@/lib/organization-ownership";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { organizationOwnershipTransferCreateSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = organizationOwnershipTransferCreateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Select an eligible owner.",
    );
  }
  try {
    return Response.json(
      {
        transfer: await createOwnershipTransfer(
          user,
          (await params).id,
          parsed.data.targetUserId,
          getRequestMeta(request),
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return organizationApiFailure("organizations.ownership.create", error);
  }
}
