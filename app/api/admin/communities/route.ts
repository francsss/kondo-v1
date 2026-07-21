import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import {
  CommunityError,
  createOfficialCommunity,
  listAdminCommunities,
} from "@/lib/communities";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { adminOfficialCommunitySchema } from "@/lib/validation";

const STATUSES = ["PENDING_REVIEW", "ACTIVE", "ARCHIVED", "REMOVED"] as const;
const TYPES = ["COUNTRY", "CITY", "UNIVERSITY", "TOPIC"] as const;

export async function GET(request: NextRequest) {
  const auth = await authorizeAdminApi("COMMUNITY_CMS_VIEW");
  if (!auth.authorized) return auth.error;
  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const type = params.get("type");
  try {
    return adminJson(
      await listAdminCommunities(auth.user, {
        page: Number(params.get("page") ?? 1),
        pageSize: Number(params.get("pageSize") ?? 20),
        query: params.get("q")?.trim() || undefined,
        status: STATUSES.includes(status as (typeof STATUSES)[number])
          ? (status as (typeof STATUSES)[number])
          : undefined,
        type: TYPES.includes(type as (typeof TYPES)[number])
          ? (type as (typeof TYPES)[number])
          : undefined,
        official:
          params.get("official") === "true"
            ? true
            : params.get("official") === "false"
              ? false
              : undefined,
      }),
    );
  } catch (error) {
    if (error instanceof CommunityError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.communities.list", error);
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("COMMUNITY_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = adminOfficialCommunitySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid community." },
      { status: 400 },
    );
  }
  try {
    return adminJson(
      await createOfficialCommunity({
        actor: auth.user,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CommunityError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.communities.create-official", error);
  }
}
