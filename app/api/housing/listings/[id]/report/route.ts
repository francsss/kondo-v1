import { NextRequest } from "next/server";
import { housingReportSchema } from "@/features/housing/schemas";
import { housingApiFailure } from "@/lib/housing-api";
import { createOrReuseHousingReport } from "@/lib/housing-reporting";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
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
    !(await rateLimit(`housing-report:${user.id}`, 12, 24 * 60 * 60_000))
      .allowed
  ) {
    return jsonError("Report limit reached.", 429);
  }
  const parsed = housingReportSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid report.");
  try {
    return Response.json(
      await createOrReuseHousingReport({
        actorId: user.id,
        listingId: (await params).id,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    return housingApiFailure("housing.report.create", error);
  }
}
