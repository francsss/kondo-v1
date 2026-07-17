import { NextRequest } from "next/server";
import { createOrReuseCommunityContentReport, CommunityError } from "@/lib/communities";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestMeta, hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { contentReportSchema } from "@/lib/validation";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!rateLimit(`content-report:${user.id}`, 12, 24 * 60 * 60_000).allowed) return jsonError("Report limit reached.", 429);
  const parsed = contentReportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid report.");
  try {
    return Response.json(await createOrReuseCommunityContentReport({ actor: user, targetType: "Post", targetId: (await params).id, ...parsed.data, meta: getRequestMeta(request) }), { status: 201 });
  } catch (error) {
    if (error instanceof CommunityError) return jsonError(error.message, error.status);
    return internalApiError("posts.report", error);
  }
}
