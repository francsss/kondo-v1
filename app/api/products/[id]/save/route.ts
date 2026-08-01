import { NextRequest } from "next/server";
import { isCatalogSaved, toggleCatalogSaved } from "@/lib/organization-catalog";
import { organizationCatalogApiFailure } from "@/lib/organization-catalog-api";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!hasTrustedOrigin(request))
      return jsonError("Invalid request origin.", 403);
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    return Response.json(
      await toggleCatalogSaved({
        kind: "product",
        userId: user.id,
        resourceId: (await params).id,
      }),
    );
  } catch (error) {
    return organizationCatalogApiFailure("products.save", error);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ saved: false });
    return Response.json({
      saved: await isCatalogSaved({
        kind: "product",
        userId: user.id,
        resourceId: (await params).id,
      }),
    });
  } catch (error) {
    return organizationCatalogApiFailure("products.save-status", error);
  }
}
