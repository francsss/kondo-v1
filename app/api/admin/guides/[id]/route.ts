import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import {
  deleteGuide,
  getAdminGuide,
  GuideError,
  updateGuide,
} from "@/lib/guides";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { updateGuideSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Context) {
  const auth = await authorizeAdminApi("GUIDE_CMS_VIEW");
  if (!auth.authorized) return auth.error;
  try {
    const guide = await getAdminGuide(auth.user, (await params).id);
    if (!guide)
      return adminJson({ error: "Guide not found." }, { status: 404 });
    return adminJson({ guide });
  } catch (error) {
    if (error instanceof GuideError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.guides.detail", error);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("GUIDE_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = updateGuideSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid guide update." },
      { status: 400 },
    );
  }
  try {
    return adminJson(
      await updateGuide({
        actor: auth.user,
        guideId: (await params).id,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof GuideError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.guides.update", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("GUIDE_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  try {
    return adminJson(
      await deleteGuide({
        actor: auth.user,
        guideId: (await params).id,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof GuideError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.guides.delete", error);
  }
}
