import { NextRequest } from "next/server";
import { adminInternalError, adminJson, authorizeAdminApi } from "@/lib/admin-auth";
import { deleteGuideStep, GuideError, upsertGuideStep } from "@/lib/guides";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { guideStepSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string; stepId: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request)) return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("GUIDE_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = guideStepSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return adminJson({ error: parsed.error.issues[0]?.message ?? "Invalid step." }, { status: 400 });
  }
  const { id, stepId } = await params;
  try {
    return adminJson(
      await upsertGuideStep({
        actor: auth.user,
        guideId: id,
        stepId,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof GuideError) return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.guides.steps.update", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request)) return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("GUIDE_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  const { id, stepId } = await params;
  try {
    return adminJson(
      await deleteGuideStep({
        actor: auth.user,
        guideId: id,
        stepId,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof GuideError) return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.guides.steps.delete", error);
  }
}
