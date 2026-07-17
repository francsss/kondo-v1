import type { ReportReason, ReportStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { listReports, ModerationError } from "@/lib/moderation";

const REPORT_STATUSES = ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"];
const REPORT_REASONS = ["SPAM", "HARASSMENT", "SCAM", "INAPPROPRIATE", "OTHER"];

export async function GET(request: NextRequest) {
  const auth = await authorizeAdminApi("REPORT_LIST");
  if (!auth.authorized) return auth.error;

  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const reason = params.get("reason");
  try {
    const result = await listReports(auth.user, {
      page: Number(params.get("page") ?? 1),
      pageSize: Number(params.get("pageSize") ?? 20),
      status: REPORT_STATUSES.includes(status ?? "")
        ? (status as ReportStatus)
        : undefined,
      reason: REPORT_REASONS.includes(reason ?? "")
        ? (reason as ReportReason)
        : undefined,
      targetType: params.get("targetType") || undefined,
      assignee: params.get("assignee") || undefined,
      query: params.get("q")?.trim() || undefined,
    });
    return adminJson(result);
  } catch (error) {
    if (error instanceof ModerationError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.reports.list", error);
  }
}
