import { NextRequest } from "next/server";
import { z } from "zod";
import { housingApiFailure } from "@/lib/housing-api";
import {
  removeHousingListingMedia,
  updateHousingListingMedia,
} from "@/lib/housing-media";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

const schema = z.object({
  altText: z.string().trim().max(240).optional(),
  caption: z.string().trim().max(240).optional().nullable(),
  isCover: z.boolean().optional(),
});
type Context = { params: Promise<{ id: string; mediaId: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid media.");
  const values = await params;
  try {
    return Response.json(
      await updateHousingListingMedia({
        actorId: user.id,
        actorRole: user.role,
        listingId: values.id,
        mediaId: values.mediaId,
        ...parsed.data,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    return housingApiFailure("housing.media.update", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const values = await params;
  try {
    return Response.json(
      await removeHousingListingMedia({
        actorId: user.id,
        actorRole: user.role,
        listingId: values.id,
        mediaId: values.mediaId,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    return housingApiFailure("housing.media.delete", error);
  }
}
