import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import {
  getAdminListing,
  MarketplaceError,
  updateListingAsAdmin,
} from "@/lib/marketplace";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { adminListingUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Context) {
  const auth = await authorizeAdminApi("MARKETPLACE_CMS_VIEW");
  if (!auth.authorized) return auth.error;
  try {
    const listing = await getAdminListing(auth.user, (await params).id);
    if (!listing)
      return adminJson({ error: "Listing not found." }, { status: 404 });
    return adminJson({ listing });
  } catch (error) {
    if (error instanceof MarketplaceError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.marketplace.detail", error);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("MARKETPLACE_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = adminListingUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return adminJson({ error: "Invalid listing update." }, { status: 400 });
  try {
    return adminJson(
      await updateListingAsAdmin({
        actor: auth.user,
        listingId: (await params).id,
        ...parsed.data,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof MarketplaceError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.marketplace.update", error);
  }
}
