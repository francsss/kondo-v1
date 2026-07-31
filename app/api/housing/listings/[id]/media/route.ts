import { NextRequest } from "next/server";
import { z } from "zod";
import { HousingListingMediaKind } from "@prisma/client";
import { housingApiFailure } from "@/lib/housing-api";
import {
  attachHousingListingMedia,
  reorderHousingListingMedia,
} from "@/lib/housing-media";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

const attachSchema = z.object({
  mediaId: z.string().trim().min(10).max(40),
  kind: z.nativeEnum(HousingListingMediaKind),
  altText: z.string().trim().max(240),
  caption: z.string().trim().max(240).optional().nullable(),
  isCover: z.boolean().optional(),
});
const reorderSchema = z.object({
  orderedIds: z.array(z.string().trim().min(10).max(40)).max(16),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const body = await request.json().catch(() => null);
  const reorder = reorderSchema.safeParse(body);
  try {
    if (reorder.success) {
      return Response.json(
        await reorderHousingListingMedia({
          actorId: user.id,
          listingId: (await params).id,
          orderedIds: reorder.data.orderedIds,
          meta: getRequestMeta(request),
        }),
      );
    }
    const parsed = attachSchema.safeParse(body);
    if (!parsed.success)
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid media.");
    return Response.json(
      await attachHousingListingMedia({
        actorId: user.id,
        actorRole: user.role,
        listingId: (await params).id,
        ...parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    return housingApiFailure("housing.media.create", error);
  }
}
