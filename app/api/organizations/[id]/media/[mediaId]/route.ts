import { NextRequest } from "next/server";
import { organizationApiFailure } from "@/lib/organization-api";
import {
  removeOrganizationGalleryMedia,
  updateOrganizationGalleryMedia,
} from "@/lib/organization-public-media";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { organizationGalleryUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string; mediaId: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = organizationGalleryUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(
      parsed.error.issues[0]?.message ?? "Check the gallery image.",
    );
  const route = await params;
  try {
    return Response.json({
      media: await updateOrganizationGalleryMedia(
        user,
        route.id,
        route.mediaId,
        parsed.data,
        getRequestMeta(request),
      ),
    });
  } catch (error) {
    return organizationApiFailure("organizations.public-media.update", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const route = await params;
  try {
    return Response.json(
      await removeOrganizationGalleryMedia(
        user,
        route.id,
        route.mediaId,
        getRequestMeta(request),
      ),
    );
  } catch (error) {
    return organizationApiFailure("organizations.public-media.remove", error);
  }
}
