import type { NextRequest } from "next/server";
import { isKondoPetPath } from "@/lib/kondo-pet";
import { createPetFeedback, PetFeedbackError } from "@/lib/pet-feedback";
import { petFeedbackSubmissionSchema } from "@/lib/pet-feedback-validation";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_KONDO_PET_ENABLED === "false") {
    return jsonError("Feedback collection is currently unavailable.", 404);
  }
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`pet-feedback:${user.id}`, 12, 24 * 60 * 60_000)).allowed
  ) {
    return jsonError(
      "You have shared several ideas today. Please try again tomorrow.",
      429,
    );
  }
  const parsed = petFeedbackSubmissionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid feedback.",
      400,
    );
  }
  if (!isKondoPetPath(parsed.data.pagePath)) {
    return jsonError("Feedback is not available on this page.", 400);
  }
  try {
    const feedback = await createPetFeedback(
      user,
      parsed.data,
      getRequestMeta(request),
    );
    return Response.json(
      { feedback },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie",
        },
      },
    );
  } catch (error) {
    if (error instanceof PetFeedbackError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("pet-feedback.submit", error);
  }
}
