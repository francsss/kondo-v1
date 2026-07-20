import { NextRequest } from "next/server";
import { adminInternalError, adminJson, authorizeAdminApi } from "@/lib/admin-auth";
import { createGuide, GuideError, listAdminGuides } from "@/lib/guides";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { createGuideSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const auth = await authorizeAdminApi("GUIDE_CMS_VIEW");
  if (!auth.authorized) return auth.error;
  const params = request.nextUrl.searchParams;
  const publishedParam = params.get("published");
  try {
    return adminJson(
      await listAdminGuides(auth.user, {
        page: Number(params.get("page") ?? 1),
        pageSize: Number(params.get("pageSize") ?? 20),
        query: params.get("q")?.trim() || undefined,
        published:
          publishedParam === "true"
            ? true
            : publishedParam === "false"
              ? false
              : undefined,
      }),
    );
  } catch (error) {
    if (error instanceof GuideError) return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.guides.list", error);
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("GUIDE_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = createGuideSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return adminJson({ error: parsed.error.issues[0]?.message ?? "Invalid guide." }, { status: 400 });
  }
  try {
    return adminJson(
      await createGuide({ actor: auth.user, data: parsed.data, meta: getRequestMeta(request) }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof GuideError) return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.guides.create", error);
  }
}
