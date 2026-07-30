import { NextRequest } from "next/server";
import { organizationApiFailure } from "@/lib/organization-api";
import { updateOrganizationProfile } from "@/lib/organization-profile-service";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { organizationProfileUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = organizationProfileUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Check the organization profile.",
    );
  }
  try {
    return Response.json({
      organization: await updateOrganizationProfile(
        user,
        (await params).id,
        parsed.data,
        getRequestMeta(request),
      ),
    });
  } catch (error) {
    return organizationApiFailure("organizations.profile.update", error);
  }
}
