import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import {
  CityHubError,
  deleteCityHubEntry,
  updateCityHubEntry,
} from "@/lib/city-hub";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import {
  cityHubEntryUpdateSchema,
  cityHubVersionSchema,
} from "@/lib/validation";

type Context = {
  params: Promise<{ id: string; sectionSlug: string; entryId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("CITY_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = cityHubEntryUpdateSchema.safeParse(
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
      await updateCityHubEntry({
        actor: auth.user,
        hubId: routeParams.id,
        sectionSlug: routeParams.sectionSlug,
        entryId: routeParams.entryId,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof CityHubError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.city-hubs.entry.update", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("CITY_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = cityHubVersionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid delete request." },
      { status: 400 },
    );
  }
  const routeParams = await params;
  try {
    return adminJson(
      await deleteCityHubEntry({
        actor: auth.user,
        hubId: routeParams.id,
        sectionSlug: routeParams.sectionSlug,
        entryId: routeParams.entryId,
        expectedVersion: parsed.data.expectedVersion,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof CityHubError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.city-hubs.entry.delete", error);
  }
}
