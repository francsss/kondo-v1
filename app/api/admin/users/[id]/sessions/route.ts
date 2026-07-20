import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { ProfileError, revokeUserSessionsAsAdmin } from "@/lib/profiles";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("USER_MANAGE");
  if (!auth.authorized) return auth.error;
  try {
    return adminJson(
      await revokeUserSessionsAsAdmin({
        actor: auth.user,
        userId: (await params).id,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof ProfileError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.users.sessions.revoke", error);
  }
}
