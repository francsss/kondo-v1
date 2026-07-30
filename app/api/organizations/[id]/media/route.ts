import { NextRequest } from "next/server";
import { organizationApiFailure } from "@/lib/organization-api";
import {
  addOrganizationGalleryMedia,
  reorderOrganizationGalleryMedia,
} from "@/lib/organization-public-media";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import {
  organizationGalleryCreateSchema,
  organizationGalleryReorderSchema,
} from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = organizationGalleryCreateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(
      parsed.error.issues[0]?.message ?? "Check the gallery image.",
    );
  try {
    return Response.json(
      {
        media: await addOrganizationGalleryMedia(
          user,
          (await params).id,
          parsed.data,
          getRequestMeta(request),
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return organizationApiFailure("organizations.public-media.add", error);
  }
}

export async function PUT(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = organizationGalleryReorderSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Check the gallery order.");
  try {
    return Response.json(
      await reorderOrganizationGalleryMedia(
        user,
        (await params).id,
        parsed.data.mediaIds,
        getRequestMeta(request),
      ),
    );
  } catch (error) {
    return organizationApiFailure("organizations.public-media.reorder", error);
  }
}
