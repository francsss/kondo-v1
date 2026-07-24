import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import {
  decideVerificationRequest,
  OfficialProfileError,
} from "@/lib/official-profiles";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { verificationAdminDecisionSchema } from "@/lib/story-validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("OFFICIAL_PROFILE_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = verificationAdminDecisionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid decision." },
      { status: 400 },
    );
  }
  try {
    return adminJson(
      await decideVerificationRequest(
        auth.user,
        (await params).id,
        parsed.data,
        getRequestMeta(request),
      ),
    );
  } catch (error) {
    if (error instanceof OfficialProfileError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.official-profiles.update", error);
  }
}
