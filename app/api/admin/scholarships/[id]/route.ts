import { NextRequest } from "next/server";
import { scholarshipUpdateSchema } from "@/features/scholarships/schemas";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import {
  archiveScholarship,
  ScholarshipError,
  updateScholarship,
} from "@/lib/scholarships";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("STUDENT_HUB_CONFIG_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = scholarshipUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid scholarship." },
      { status: 400 },
    );
  }
  try {
    return adminJson(
      await updateScholarship({
        actor: auth.user,
        scholarshipId: (await params).id,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof ScholarshipError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.scholarships.update", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("STUDENT_HUB_CONFIG_MANAGE");
  if (!auth.authorized) return auth.error;
  try {
    return adminJson(
      await archiveScholarship({
        actor: auth.user,
        scholarshipId: (await params).id,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof ScholarshipError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.scholarships.archive", error);
  }
}
