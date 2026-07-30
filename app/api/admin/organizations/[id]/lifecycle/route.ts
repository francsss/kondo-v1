import { NextRequest } from "next/server";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { updateOrganizationLifecycleAsAdmin } from "@/lib/organization-admin";
import { organizationApiFailure } from "@/lib/organization-api";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { organizationLifecycleUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const parsed = organizationLifecycleUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Check the lifecycle action.",
    );
  }
  const auth = await authorizeAdminApi(
    parsed.data.status === "ARCHIVED"
      ? "ORGANIZATIONS_ARCHIVE"
      : "ORGANIZATIONS_SUSPEND",
  );
  if (!auth.authorized) return auth.error;
  try {
    return Response.json({
      organization: await updateOrganizationLifecycleAsAdmin(
        auth.user,
        (await params).id,
        parsed.data,
        getRequestMeta(request),
      ),
    });
  } catch (error) {
    return organizationApiFailure("admin.organizations.lifecycle", error);
  }
}
