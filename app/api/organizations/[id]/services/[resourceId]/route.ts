import { NextRequest } from "next/server";
import { catalogResourceSchema } from "@/features/catalog/schemas";
import {
  getCatalogResourceForEdit,
  updateOrganizationCatalogResource,
} from "@/lib/organization-catalog";
import { organizationCatalogApiFailure } from "@/lib/organization-catalog-api";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string; resourceId: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const { id, resourceId } = await params;
    return Response.json(
      await getCatalogResourceForEdit({
        kind: "service",
        userId: user.id,
        organizationId: id,
        resourceId,
      }),
    );
  } catch (error) {
    return organizationCatalogApiFailure("organization.services.get", error);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    if (!hasTrustedOrigin(request))
      return jsonError("Invalid request origin.", 403);
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const { id, resourceId } = await params;
    return Response.json(
      await updateOrganizationCatalogResource({
        kind: "service",
        userId: user.id,
        organizationId: id,
        resourceId,
        data: catalogResourceSchema.parse(await request.json()),
      }),
    );
  } catch (error) {
    return organizationCatalogApiFailure("organization.services.update", error);
  }
}
