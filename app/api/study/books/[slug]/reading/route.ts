import { NextRequest } from "next/server";
import { z } from "zod";
import { internalApiError, jsonError, hasTrustedOrigin } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { StudyEssentialError } from "@/lib/study-essentials";
import { getReadingState, saveReadingProgress } from "@/lib/study-reading";

/**
 * Everything the reader needs to resume, and the one write that records where
 * it got to. Both entitlement-checked in the service, not here, so no route
 * can forget.
 */

export const dynamic = "force-dynamic";

const progressSchema = z.object({
  // A CFI is long but bounded; the column is 600 and this refuses anything
  // that would be truncated into a locator that no longer resolves.
  locator: z.string().trim().min(1).max(600),
  // Optional on purpose. The reader knows where it is before it knows how far
  // through that is, and a position worth saving should not wait on an index.
  percentage: z.number().finite().optional().nullable(),
});

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  try {
    const state = await getReadingState(user.id, (await params).slug);
    return Response.json(state, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "Cookie",
      },
    });
  } catch (error) {
    if (error instanceof StudyEssentialError)
      return jsonError(error.message, error.status);
    return internalApiError("study.reading.get", error);
  }
}

export async function PUT(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  const parsed = progressSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid reading position.");

  try {
    const progress = await saveReadingProgress({
      userId: user.id,
      slug: (await params).slug,
      locator: parsed.data.locator,
      percentage: parsed.data.percentage,
    });
    return Response.json(progress, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    if (error instanceof StudyEssentialError)
      return jsonError(error.message, error.status);
    return internalApiError("study.reading.save", error);
  }
}
