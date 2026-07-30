import { NextRequest } from "next/server";
import { adminJson, authorizeAdminApi } from "@/lib/admin-auth";
import { organizationApiFailure } from "@/lib/organization-api";
import { moderateOrganizationPublicProfile } from "@/lib/organization-public-moderation";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { organizationPublicModerationSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const body = await request.json().catch(() => null);
  const parsed = organizationPublicModerationSchema.safeParse(body);
  if (!parsed.success)
    return jsonError(
      parsed.error.issues[0]?.message ?? "Check the moderation action.",
    );
  const permission =
    parsed.data.action === "UNPUBLISH"
      ? "ORGANIZATION_PUBLIC_PROFILES_UNPUBLISH"
      : parsed.data.action === "RESTORE"
        ? "ORGANIZATION_PUBLIC_PROFILES_RESTORE"
        : "ORGANIZATION_PUBLIC_PROFILES_MODERATE";
  const auth = await authorizeAdminApi(permission);
  if (!auth.authorized) return auth.error;
  try {
    return adminJson({
      organization: await moderateOrganizationPublicProfile(
        auth.user,
        (await params).id,
        parsed.data,
        getRequestMeta(request),
      ),
    });
  } catch (error) {
    return organizationApiFailure("admin.organizations.public-profile", error);
  }
}
