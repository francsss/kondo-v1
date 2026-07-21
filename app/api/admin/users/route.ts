import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { listAdminUsers, ProfileError } from "@/lib/profiles";

const STATUSES = ["ACTIVE", "SUSPENDED", "DEACTIVATED"] as const;
const ROLES = ["MEMBER", "MODERATOR", "ADMIN", "SUPER_ADMIN"] as const;

export async function GET(request: NextRequest) {
  const auth = await authorizeAdminApi("USER_VIEW");
  if (!auth.authorized) return auth.error;
  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const role = params.get("role");
  try {
    return adminJson(
      await listAdminUsers(auth.user, {
        page: Number(params.get("page") ?? 1),
        pageSize: Number(params.get("pageSize") ?? 25),
        query: params.get("q")?.trim() || undefined,
        status: STATUSES.includes(status as (typeof STATUSES)[number])
          ? (status as (typeof STATUSES)[number])
          : undefined,
        role: ROLES.includes(role as (typeof ROLES)[number])
          ? (role as (typeof ROLES)[number])
          : undefined,
      }),
    );
  } catch (error) {
    if (error instanceof ProfileError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.users.list", error);
  }
}
