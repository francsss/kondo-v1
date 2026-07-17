import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { addReportNote, ModerationError } from "@/lib/moderation";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { reportNoteSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("REPORT_ADD_NOTE");
  if (!auth.authorized) return auth.error;
  const parsed = reportNoteSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid note." },
      { status: 400 },
    );
  }
  const { id } = await params;
  try {
    const note = await addReportNote({
      actor: auth.user,
      reportId: id,
      body: parsed.data.body,
      metadata: getRequestMeta(request),
    });
    return adminJson({ note }, { status: 201 });
  } catch (error) {
    if (error instanceof ModerationError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.reports.note", error);
  }
}
