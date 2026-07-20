import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { ProfileError, transitionAccountRequest } from "@/lib/profiles";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { accountRequestAdminSchema } from "@/lib/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("ACCOUNT_REQUEST_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = accountRequestAdminSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      {
        error:
          parsed.error.issues[0]?.message ?? "Invalid account-request update.",
      },
      { status: 400 },
    );
  }
  try {
    return adminJson({
      request: await transitionAccountRequest(
        auth.user,
        {
          requestId: (await params).id,
          ...parsed.data,
        },
        getRequestMeta(request),
      ),
    });
  } catch (error) {
    if (error instanceof ProfileError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.account-request.update", error);
  }
}
