import { NextRequest } from "next/server";
import { z } from "zod";
import { organizationCatalogApiFailure } from "@/lib/organization-catalog-api";
import { attachCatalogMedia } from "@/lib/organization-catalog-media";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

const schema = z.object({
  mediaId: z.string().cuid(),
  mediaKind: z.enum(["COVER", "GALLERY"]),
  altText: z.string().trim().min(3).max(240),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; resourceId: string }> },
) {
  try {
    if (!hasTrustedOrigin(request))
      return jsonError("Invalid request origin.", 403);
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const { id, resourceId } = await params;
    return Response.json(
      await attachCatalogMedia({
        kind: "service",
        userId: user.id,
        organizationId: id,
        resourceId,
        ...schema.parse(await request.json()),
      }),
    );
  } catch (error) {
    return organizationCatalogApiFailure("organization.services.media", error);
  }
}
