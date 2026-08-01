import { NextRequest } from "next/server";
import { catalogResourceSchema } from "@/features/catalog/schemas";
import {
  createOrganizationCatalogResource,
  listOrganizationCatalog,
} from "@/lib/organization-catalog";
import { organizationCatalogApiFailure } from "@/lib/organization-catalog-api";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    return Response.json(
      await listOrganizationCatalog({
        kind: "product",
        userId: user.id,
        organizationId: (await params).id,
      }),
    );
  } catch (error) {
    return organizationCatalogApiFailure("organization.products.list", error);
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    if (!hasTrustedOrigin(request))
      return jsonError("Invalid request origin.", 403);
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    return Response.json(
      await createOrganizationCatalogResource({
        kind: "product",
        userId: user.id,
        organizationId: (await params).id,
        data: catalogResourceSchema.parse(await request.json()),
      }),
      { status: 201 },
    );
  } catch (error) {
    return organizationCatalogApiFailure("organization.products.create", error);
  }
}
