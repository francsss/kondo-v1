import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { GuideError, removeGuideSource } from "@/lib/guides";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";

type Context = { params: Promise<{ sourceId: string }> };

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("GUIDE_CMS_MANAGE");
  if (!auth.authorized) return auth.error;

  try {
    return adminJson(
      await removeGuideSource({
        actor: auth.user,
        sourceId: (await params).sourceId,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof GuideError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.guides.source.remove", error);
  }
}
