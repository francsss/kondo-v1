import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { GuideError, setGuidePublished } from "@/lib/guides";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { guidePublishSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("GUIDE_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = guidePublishSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson({ error: "Invalid publish request." }, { status: 400 });
  }
  try {
    return adminJson(
      await setGuidePublished({
        actor: auth.user,
        guideId: (await params).id,
        published: parsed.data.published,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof GuideError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.guides.publish", error);
  }
}
