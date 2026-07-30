import { NextRequest } from "next/server";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { organizationApiFailure } from "@/lib/organization-api";
import { decideOrganizationVerification } from "@/lib/organization-verification";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { organizationVerificationDecisionSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const auth = await authorizeAdminApi("ORGANIZATION_VERIFICATIONS_REVIEW");
  if (!auth.authorized) return auth.error;
  const parsed = organizationVerificationDecisionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Check the verification decision.",
    );
  }
  try {
    return Response.json({
      verification: await decideOrganizationVerification(
        auth.user,
        (await params).id,
        parsed.data,
        getRequestMeta(request),
      ),
    });
  } catch (error) {
    return organizationApiFailure(
      "admin.organization-verification.decision",
      error,
    );
  }
}
