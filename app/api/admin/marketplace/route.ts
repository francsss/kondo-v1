import { NextRequest } from "next/server";
import { adminInternalError, adminJson, authorizeAdminApi } from "@/lib/admin-auth";
import { listAdminListings, MarketplaceError } from "@/lib/marketplace";

const STATUSES = ["DRAFT", "ACTIVE", "RESERVED", "SOLD", "ARCHIVED", "EXPIRED", "REMOVED"] as const;

export async function GET(request: NextRequest) {
  const auth = await authorizeAdminApi("MARKETPLACE_CMS_VIEW");
  if (!auth.authorized) return auth.error;
  const params = request.nextUrl.searchParams;
  const rawStatus = params.get("status");
  try {
    return adminJson(await listAdminListings(auth.user, {
      page: Number(params.get("page") ?? 1),
      pageSize: Number(params.get("pageSize") ?? 20),
      query: params.get("q")?.trim() || undefined,
      status: STATUSES.includes(rawStatus as (typeof STATUSES)[number])
        ? rawStatus as (typeof STATUSES)[number]
        : undefined,
      flagged: params.get("flagged") === "true",
    }));
  } catch (error) {
    if (error instanceof MarketplaceError) return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.marketplace.list", error);
  }
}
