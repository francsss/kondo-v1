import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import {
  deleteMarketplaceCategory,
  MarketplaceError,
  upsertMarketplaceCategory,
} from "@/lib/marketplace";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { marketplaceCategorySchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("MARKETPLACE_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = marketplaceCategorySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return adminJson({ error: "Invalid category." }, { status: 400 });
  try {
    return adminJson(
      await upsertMarketplaceCategory({
        actor: auth.user,
        categoryId: (await params).id,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof MarketplaceError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.marketplace.category.update", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("MARKETPLACE_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  try {
    await deleteMarketplaceCategory({
      actor: auth.user,
      categoryId: (await params).id,
      meta: getRequestMeta(request),
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof MarketplaceError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.marketplace.category.delete", error);
  }
}
