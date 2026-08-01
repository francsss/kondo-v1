import { NextRequest } from "next/server";
import { catalogInquirySchema } from "@/features/catalog/schemas";
import { createCatalogInquiry } from "@/lib/organization-catalog";
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
    const body = catalogInquirySchema.parse(await request.json());
    return Response.json(
      await createCatalogInquiry({
        kind: "service",
        userId: user.id,
        resourceId: (await params).id,
        ...body,
      }),
      { status: 201 },
    );
  } catch (error) {
    return organizationCatalogApiFailure("services.inquiry", error);
  }
}
