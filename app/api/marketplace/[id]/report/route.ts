import { NextRequest } from "next/server";
import {
  createOrReuseListingReport,
  MarketplaceError,
} from "@/lib/marketplace";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { contentReportSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`listing-report:${user.id}`, 12, 24 * 60 * 60_000))
      .allowed
  )
    return jsonError("Report limit reached.", 429);
  const parsed = contentReportSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid report.");
  try {
    return Response.json(
      await createOrReuseListingReport({
        actor: user,
        listingId: (await params).id,
        ...parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof MarketplaceError)
      return jsonError(error.message, error.status);
    return internalApiError("marketplace.report", error);
  }
}
