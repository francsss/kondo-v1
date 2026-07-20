import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import {
  listMarketplaceCategories,
  MarketplaceError,
  upsertMarketplaceCategory,
} from "@/lib/marketplace";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { marketplaceCategorySchema } from "@/lib/validation";

export async function GET() {
  const auth = await authorizeAdminApi("MARKETPLACE_CMS_VIEW");
  if (!auth.authorized) return auth.error;
  return adminJson({ categories: await listMarketplaceCategories(true) });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("MARKETPLACE_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = marketplaceCategorySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid category." },
      { status: 400 },
    );
  try {
    return adminJson(
      await upsertMarketplaceCategory({
        actor: auth.user,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof MarketplaceError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.marketplace.category.create", error);
  }
}
