import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { ModerationError, transitionReport } from "@/lib/moderation";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { reportTransitionSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("REPORT_TRANSITION_ASSIGNED");
  if (!auth.authorized) return auth.error;
  const parsed = reportTransitionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid report transition.",
      },
      { status: 400 },
    );
  }
  const { id } = await params;
  try {
    const report = await transitionReport({
      actor: auth.user,
      reportId: id,
      status: parsed.data.status,
      expectedVersion: parsed.data.expectedVersion,
      decision: parsed.data.decision,
      resolution: parsed.data.resolution,
      metadata: getRequestMeta(request),
    });
    return adminJson({ report });
  } catch (error) {
    if (error instanceof ModerationError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.reports.transition", error);
  }
}
