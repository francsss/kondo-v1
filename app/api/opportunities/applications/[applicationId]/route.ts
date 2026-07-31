import { NextRequest } from "next/server";
import { applicationDraftSchema } from "@/features/opportunities/schemas";
import {
  getApplicationForApplicant,
  saveApplicationDraft,
} from "@/lib/opportunity-applications";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ applicationId: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const application = await getApplicationForApplicant({
      userId: user.id,
      applicationId: (await params).applicationId,
    });
    if (!application) return jsonError("Application not found.", 404);
    return Response.json(application);
  } catch (error) {
    return opportunityApiFailure("opportunities.applications.get", error);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    if (!hasTrustedOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const body = applicationDraftSchema.parse(await request.json());
    return Response.json(
      await saveApplicationDraft({
        userId: user.id,
        applicationId: (await params).applicationId,
        answers: body.answers?.map((answer) => ({
          questionId: answer.questionId,
          answerText: answer.answerText ?? null,
          answerStructured: (answer.answerStructured as never) ?? null,
        })),
        documentIds: body.documentIds,
      }),
    );
  } catch (error) {
    return opportunityApiFailure("opportunities.applications.draft", error);
  }
}
