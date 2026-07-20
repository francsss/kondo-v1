import { NextRequest } from "next/server";
import { adminInternalError, adminJson, authorizeAdminApi } from "@/lib/admin-auth";
import { CityHubError, createCityHub, listAdminCityHubs, type CityHubStatus } from "@/lib/city-hub";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { cityHubCreateSchema } from "@/lib/validation";

const STATUSES: readonly CityHubStatus[] = ["DRAFT", "REVIEW", "PUBLISHED"];

export async function GET(request: NextRequest) {
  const auth = await authorizeAdminApi("CITY_CMS_VIEW");
  if (!auth.authorized) return auth.error;
  const params = request.nextUrl.searchParams;
  const statusParam = params.get("status");
  const status = STATUSES.includes(statusParam as CityHubStatus)
    ? (statusParam as CityHubStatus)
    : undefined;
  try {
    return adminJson(
      await listAdminCityHubs(auth.user, {
        page: Number(params.get("page") ?? 1),
        pageSize: Number(params.get("pageSize") ?? 20),
        query: params.get("q")?.trim() || undefined,
        status,
      }),
    );
  } catch (error) {
    if (error instanceof CityHubError) return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.city-hubs.list", error);
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("CITY_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = cityHubCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return adminJson({ error: parsed.error.issues[0]?.message ?? "Invalid city hub." }, { status: 400 });
  }
  try {
    return adminJson(
      await createCityHub({ actor: auth.user, data: parsed.data, meta: getRequestMeta(request) }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CityHubError) return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.city-hubs.create", error);
  }
}
