import { NextRequest } from "next/server";
import {
  archiveOrganization,
  completeOrganizationOnboarding,
  getOrganizationForSetup,
  OrganizationError,
  updateOrganizationDraft,
} from "@/lib/organizations";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import {
  organizationOnboardingCompleteSchema,
  organizationOnboardingDraftSchema,
} from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

function failure(event: string, error: unknown) {
  if (error instanceof OrganizationError) {
    return jsonError(error.message, error.status);
  }
  return internalApiError(event, error);
}

export async function GET(_: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    return Response.json({
      organization: await getOrganizationForSetup(user, (await params).id),
    });
  } catch (error) {
    return failure("organizations.onboarding.read", error);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = organizationOnboardingDraftSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Check the organization details.",
    );
  }
  try {
    return Response.json({
      organization: await updateOrganizationDraft(
        user,
        (await params).id,
        parsed.data,
        getRequestMeta(request),
      ),
    });
  } catch (error) {
    return failure("organizations.onboarding.update", error);
  }
}

export async function PUT(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = organizationOnboardingCompleteSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ??
        "Complete the required organization details.",
    );
  }
  try {
    return Response.json({
      organization: await completeOrganizationOnboarding(
        user,
        (await params).id,
        parsed.data,
        getRequestMeta(request),
      ),
    });
  } catch (error) {
    return failure("organizations.onboarding.complete", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    await archiveOrganization(user, (await params).id, getRequestMeta(request));
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure("organizations.archive", error);
  }
}
