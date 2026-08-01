import { NextRequest } from "next/server";
import { authorizeAdminApi } from "@/lib/admin-auth";
import {
  moderateCatalogResource,
  OrganizationCatalogError,
} from "@/lib/organization-catalog";
import { hasTrustedOrigin, jsonError } from "@/lib/request";

const ACTIONS = ["REMOVE", "RESTORE_FOR_REVIEW", "BLOCK_EXTERNAL_URL"] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  try {
    if (!hasTrustedOrigin(request))
      return jsonError("Invalid request origin.", 403);
    const auth = await authorizeAdminApi("ORGANIZATION_CATALOG_MODERATE");
    if (!auth.authorized) return auth.error;
    const { kind, id } = await params;
    if (kind !== "products" && kind !== "services") {
      return jsonError("Unsupported catalog resource.", 404);
    }
    const body = (await request.json().catch(() => null)) as {
      action?: string;
      note?: string;
    } | null;
    if (!ACTIONS.includes(body?.action as (typeof ACTIONS)[number])) {
      return jsonError("Unsupported moderation action.", 400);
    }
    return Response.json(
      await moderateCatalogResource({
        kind: kind === "products" ? "product" : "service",
        resourceId: id,
        adminUserId: auth.user.id,
        action: body!.action as (typeof ACTIONS)[number],
        note: body?.note,
      }),
    );
  } catch (error) {
    if (error instanceof OrganizationCatalogError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Catalog moderation failed.", 500);
  }
}
