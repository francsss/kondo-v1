import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { CityHubError, deleteCityHub, getAdminCityHub } from "@/lib/city-hub";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Context) {
  const auth = await authorizeAdminApi("CITY_CMS_VIEW");
  if (!auth.authorized) return auth.error;
  try {
    const hub = await getAdminCityHub(auth.user, (await params).id);
    if (!hub)
      return adminJson({ error: "City hub not found." }, { status: 404 });
    return adminJson({ hub });
  } catch (error) {
    if (error instanceof CityHubError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.city-hubs.detail", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("CITY_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  try {
    return adminJson(
      await deleteCityHub({
        actor: auth.user,
        hubId: (await params).id,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof CityHubError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.city-hubs.delete", error);
  }
}
