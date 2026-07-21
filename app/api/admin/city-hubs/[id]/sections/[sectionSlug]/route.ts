import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { CityHubError, updateCityHubSection } from "@/lib/city-hub";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { cityHubSectionUpdateSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string; sectionSlug: string }>;
};

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("CITY_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = cityHubSectionUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid section." },
      { status: 400 },
    );
  }
  const routeParams = await params;
  try {
    return adminJson(
      await updateCityHubSection({
        actor: auth.user,
        hubId: routeParams.id,
        sectionSlug: routeParams.sectionSlug,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof CityHubError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.city-hubs.section.update", error);
  }
}
