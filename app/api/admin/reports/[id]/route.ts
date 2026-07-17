import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { getReportDetail, ModerationError } from "@/lib/moderation";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeAdminApi("REPORT_VIEW");
  if (!auth.authorized) return auth.error;
  const { id } = await params;
  try {
    const report = await getReportDetail(auth.user, id);
    if (!report)
      return adminJson({ error: "Report not found." }, { status: 404 });
    return adminJson({ report });
  } catch (error) {
    if (error instanceof ModerationError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.reports.detail", error);
  }
}
