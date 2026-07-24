import { NextRequest } from "next/server";
import { scholarshipAgentReportSchema } from "@/features/scholarships/schemas";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import {
  createOrReuseScholarshipAgentReport,
  ScholarshipError,
} from "@/lib/scholarships";
import { getCurrentUser } from "@/lib/server-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`scholarship-agent-report:${user.id}`, 12, 86_400_000))
      .allowed
  ) {
    return jsonError("Report limit reached.", 429);
  }
  const parsed = scholarshipAgentReportSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid report.");
  try {
    return Response.json(
      await createOrReuseScholarshipAgentReport({
        actor: user,
        agentId: (await params).id,
        ...parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ScholarshipError)
      return jsonError(error.message, error.status);
    return internalApiError("scholarship-agent.report", error);
  }
}
