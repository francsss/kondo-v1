import type { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { PetFeedbackError, updatePetFeedbackStatus } from "@/lib/pet-feedback";
import { petFeedbackStatusSchema } from "@/lib/pet-feedback-validation";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("FEEDBACK_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = petFeedbackStatusSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid status update." },
      { status: 400 },
    );
  }
  try {
    const feedback = await updatePetFeedbackStatus(
      auth.user,
      (await params).id,
      parsed.data,
      getRequestMeta(request),
    );
    return adminJson({ feedback });
  } catch (error) {
    if (error instanceof PetFeedbackError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.pet-feedback.update", error);
  }
}
