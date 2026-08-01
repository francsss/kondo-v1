import { NextRequest } from "next/server";
import { catalogTransitionSchema } from "@/features/catalog/schemas";
import { transitionOrganizationCatalogResource } from "@/lib/organization-catalog";
import { organizationCatalogApiFailure } from "@/lib/organization-catalog-api";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string; resourceId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    if (!hasTrustedOrigin(request))
      return jsonError("Invalid request origin.", 403);
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const { id, resourceId } = await params;
    const { action } = catalogTransitionSchema.parse(await request.json());
    return Response.json(
      await transitionOrganizationCatalogResource({
        kind: "service",
        userId: user.id,
        organizationId: id,
        resourceId,
        action,
      }),
    );
  } catch (error) {
    return organizationCatalogApiFailure(
      "organization.services.transition",
      error,
    );
  }
}
