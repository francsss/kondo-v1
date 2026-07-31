import { NextRequest } from "next/server";
import { housingInquirySchema } from "@/features/housing/schemas";
import { housingApiFailure } from "@/lib/housing-api";
import { createHousingInquiry } from "@/lib/housing-inquiries";
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
    !(await rateLimit(`housing-inquiry:${user.id}`, 20, 60 * 60_000)).allowed
  ) {
    return jsonError("Inquiry limit reached. Please try again later.", 429);
  }
  const parsed = housingInquirySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid inquiry.");
  try {
    return Response.json(
      await createHousingInquiry({
        actorId: user.id,
        listingId: (await params).id,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    return housingApiFailure("housing.inquiry.create", error);
  }
}
