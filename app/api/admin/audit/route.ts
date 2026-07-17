import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { listAuditLogs, ModerationError } from "@/lib/moderation";

export async function GET(request: NextRequest) {
  const auth = await authorizeAdminApi("AUDIT_VIEW_GLOBAL");
  if (!auth.authorized) return auth.error;
  const params = request.nextUrl.searchParams;
  try {
    const result = await listAuditLogs(auth.user, {
      page: Number(params.get("page") ?? 1),
      pageSize: Number(params.get("pageSize") ?? 20),
      action: params.get("action")?.trim() || undefined,
      entityType: params.get("entityType")?.trim() || undefined,
      actorId: params.get("actorId")?.trim() || undefined,
      query: params.get("q")?.trim() || undefined,
    });
    return adminJson(result);
  } catch (error) {
    if (error instanceof ModerationError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.audit.list", error);
  }
}
