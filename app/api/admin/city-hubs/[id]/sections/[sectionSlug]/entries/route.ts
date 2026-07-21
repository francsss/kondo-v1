import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { CityHubError, createCityHubEntry } from "@/lib/city-hub";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { cityHubEntryCreateSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string; sectionSlug: string }>;
};

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("CITY_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = cityHubEntryCreateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid entry." },
      { status: 400 },
    );
  }
  const routeParams = await params;
  try {
    return adminJson(
      await createCityHubEntry({
        actor: auth.user,
        hubId: routeParams.id,
        sectionSlug: routeParams.sectionSlug,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CityHubError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.city-hubs.entry.create", error);
  }
}
