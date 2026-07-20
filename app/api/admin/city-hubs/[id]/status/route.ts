import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { CityHubError, setCityHubStatus } from "@/lib/city-hub";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { cityHubStatusSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("CITY_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = cityHubStatusSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid status change." },
      { status: 400 },
    );
  }
  try {
    return adminJson(
      await setCityHubStatus({
        actor: auth.user,
        hubId: (await params).id,
        status: parsed.data.status,
        expectedVersion: parsed.data.expectedVersion,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof CityHubError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.city-hubs.status", error);
  }
}
