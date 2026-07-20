import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { ProfileError, updateUserStatusAsAdmin } from "@/lib/profiles";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { adminUserStatusSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("USER_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = adminUserStatusSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid status update." },
      { status: 400 },
    );
  }
  try {
    return adminJson(
      await updateUserStatusAsAdmin({
        actor: auth.user,
        userId: (await params).id,
        status: parsed.data.status,
        reason: parsed.data.reason,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof ProfileError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.users.status", error);
  }
}
