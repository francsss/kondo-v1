import type { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { addPetFeedbackNote, PetFeedbackError } from "@/lib/pet-feedback";
import { petFeedbackNoteSchema } from "@/lib/pet-feedback-validation";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("FEEDBACK_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = petFeedbackNoteSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid internal note." },
      { status: 400 },
    );
  }
  try {
    const note = await addPetFeedbackNote(
      auth.user,
      (await params).id,
      parsed.data,
      getRequestMeta(request),
    );
    return adminJson({ note }, { status: 201 });
  } catch (error) {
    if (error instanceof PetFeedbackError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.pet-feedback.note", error);
  }
}
