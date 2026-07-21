import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { ProfileError, updateUserRoleAsAdmin } from "@/lib/profiles";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { adminUserRoleSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("USER_ROLE_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = adminUserRoleSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid role update." },
      { status: 400 },
    );
  }

  try {
    return adminJson(
      await updateUserRoleAsAdmin({
        actor: auth.user,
        userId: (await params).id,
        role: parsed.data.role,
        reason: parsed.data.reason,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof ProfileError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.users.role", error);
  }
}
