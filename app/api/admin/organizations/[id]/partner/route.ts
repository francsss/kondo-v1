import { NextRequest } from "next/server";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { updateOrganizationPartnerStatus } from "@/lib/organization-admin";
import { organizationApiFailure } from "@/lib/organization-api";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { organizationPartnerUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const auth = await authorizeAdminApi("ORGANIZATION_PARTNER_STATUS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = organizationPartnerUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Check the partner action.",
    );
  }
  try {
    return Response.json({
      organization: await updateOrganizationPartnerStatus(
        auth.user,
        (await params).id,
        parsed.data.isOfficialPartner,
        parsed.data.reason,
        getRequestMeta(request),
      ),
    });
  } catch (error) {
    return organizationApiFailure("admin.organizations.partner", error);
  }
}
