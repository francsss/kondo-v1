import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { assignReport, ModerationError } from "@/lib/moderation";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { reportAssignmentSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("REPORT_CLAIM");
  if (!auth.authorized) return auth.error;
  const parsed = reportAssignmentSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid assignment." },
      { status: 400 },
    );
  }
  const { id } = await params;
  try {
    const report = await assignReport({
      actor: auth.user,
      reportId: id,
      assigneeId: parsed.data.assigneeId,
      expectedVersion: parsed.data.expectedVersion,
      metadata: getRequestMeta(request),
    });
    return adminJson({ report });
  } catch (error) {
    if (error instanceof ModerationError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.reports.assignment", error);
  }
}
