import { NextRequest } from "next/server";
import { scholarshipAgentUpdateSchema } from "@/features/scholarships/schemas";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import {
  archiveScholarshipAgent,
  ScholarshipError,
  updateScholarshipAgent,
} from "@/lib/scholarships";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("STUDENT_HUB_CONFIG_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = scholarshipAgentUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid agent profile." },
      { status: 400 },
    );
  }
  try {
    return adminJson(
      await updateScholarshipAgent({
        actor: auth.user,
        agentId: (await params).id,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof ScholarshipError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.scholarship-agents.update", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("STUDENT_HUB_CONFIG_MANAGE");
  if (!auth.authorized) return auth.error;
  try {
    return adminJson(
      await archiveScholarshipAgent({
        actor: auth.user,
        agentId: (await params).id,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof ScholarshipError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.scholarship-agents.archive", error);
  }
}
