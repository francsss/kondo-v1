import { NextRequest } from "next/server";
import { catalogReportSchema } from "@/features/catalog/schemas";
import { reportCatalogResource } from "@/lib/organization-catalog";
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
    const body = catalogReportSchema.parse(await request.json());
    return Response.json(
      await reportCatalogResource({
        kind: "service",
        userId: user.id,
        resourceId: (await params).id,
        ...body,
      }),
      { status: 201 },
    );
  } catch (error) {
    return organizationCatalogApiFailure("services.report", error);
  }
}
