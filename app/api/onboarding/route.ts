import { NextRequest } from "next/server";
import { completeOnboarding, saveOnboardingDraft } from "@/lib/onboarding";
import { ReferenceDataError } from "@/lib/reference-data";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { onboardingDraftSchema, onboardingSchema } from "@/lib/validation";

export async function PUT(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  const payload = await request.json().catch(() => null);
  const parsed = onboardingSchema.safeParse(payload);
  if (!parsed.success)
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid profile details.",
    );

  try {
    const onboarding = await completeOnboarding(
      user.id,
      parsed.data,
      getRequestMeta(request),
    );
    return Response.json({ ok: true, onboarding });
  } catch (error) {
    if (error instanceof ReferenceDataError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("onboarding.complete", error);
  }
}

export async function PATCH(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  const parsed = onboardingDraftSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid onboarding draft.",
    );
  }

  try {
    const onboarding = await saveOnboardingDraft(user.id, parsed.data);
    return Response.json({ ok: true, onboarding });
  } catch (error) {
    if (error instanceof ReferenceDataError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("onboarding.draft", error);
  }
}
