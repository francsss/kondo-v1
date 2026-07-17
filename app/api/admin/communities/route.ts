import { NextRequest } from "next/server";
import { adminInternalError, adminJson, authorizeAdminApi } from "@/lib/admin-auth";
import { CommunityError, listAdminCommunities } from "@/lib/communities";

const STATUSES = ["PENDING_REVIEW", "ACTIVE", "ARCHIVED", "REMOVED"] as const;
const TYPES = ["COUNTRY", "CITY", "UNIVERSITY", "TOPIC"] as const;

export async function GET(request: NextRequest) {
  const auth = await authorizeAdminApi("COMMUNITY_CMS_VIEW");
  if (!auth.authorized) return auth.error;
  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const type = params.get("type");
  try {
    return adminJson(await listAdminCommunities(auth.user, {
      page: Number(params.get("page") ?? 1),
      pageSize: Number(params.get("pageSize") ?? 20),
      query: params.get("q")?.trim() || undefined,
      status: STATUSES.includes(status as (typeof STATUSES)[number]) ? status as (typeof STATUSES)[number] : undefined,
      type: TYPES.includes(type as (typeof TYPES)[number]) ? type as (typeof TYPES)[number] : undefined,
    }));
  } catch (error) {
    if (error instanceof CommunityError) return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.communities.list", error);
  }
}
