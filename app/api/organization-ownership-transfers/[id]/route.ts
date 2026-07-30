import { NextRequest } from "next/server";
import { organizationApiFailure } from "@/lib/organization-api";
import { decideOwnershipTransfer } from "@/lib/organization-ownership";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { z } from "zod";

const decisionSchema = z.object({
  action: z.enum(["ACCEPT", "DECLINE", "CANCEL"]),
});

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = decisionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Select a valid transfer action.");
  try {
    return Response.json({
      transfer: await decideOwnershipTransfer(
        user,
        (await params).id,
        parsed.data.action,
        getRequestMeta(request),
      ),
    });
  } catch (error) {
    return organizationApiFailure("organizations.ownership.decision", error);
  }
}
