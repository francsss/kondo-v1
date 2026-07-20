import { NextRequest } from "next/server";
import {
  createOrReuseConversationReport,
  ModerationError,
} from "@/lib/moderation";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { reportConversationSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`conversation-report:${user.id}`, 5, 24 * 60 * 60_000)).allowed
  ) {
    return jsonError("Report limit reached. Try again later.", 429);
  }
  const parsed = reportConversationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid report.");
  }
  const { id } = await params;
  try {
    const result = await createOrReuseConversationReport({
      reporterId: user.id,
      conversationId: id,
      reason: parsed.data.reason,
      details: parsed.data.details,
      metadata: getRequestMeta(request),
    });
    return Response.json(
      { reportId: result.reportId },
      { status: result.reused ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof ModerationError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("conversation.report", error);
  }
}
