import { NextRequest } from "next/server";
import { organizationApiFailure } from "@/lib/organization-api";
import { updateOrganizationCapabilities } from "@/lib/organization-profile-service";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { organizationCapabilitiesUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = organizationCapabilitiesUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Select valid activity areas.",
    );
  }
  try {
    return Response.json(
      await updateOrganizationCapabilities(
        user,
        (await params).id,
        parsed.data.capabilities,
        getRequestMeta(request),
      ),
    );
  } catch (error) {
    return organizationApiFailure("organizations.capabilities.update", error);
  }
}
