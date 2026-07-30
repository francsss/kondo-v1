import { NextRequest } from "next/server";
import { organizationApiFailure } from "@/lib/organization-api";
import {
  getOrganizationVerificationState,
  saveOrganizationVerificationDraft,
  submitOrganizationVerification,
} from "@/lib/organization-verification";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import {
  organizationVerificationDraftSchema,
  organizationVerificationSubmitSchema,
} from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    return Response.json({
      verification: await getOrganizationVerificationState(
        user.id,
        (await params).id,
      ),
    });
  } catch (error) {
    return organizationApiFailure("organizations.verification.read", error);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const organizationId = (await params).id;
  if (
    !(
      await rateLimit(
        `organization-verification-draft:${organizationId}:${user.id}`,
        60,
        24 * 60 * 60_000,
      )
    ).allowed
  ) {
    return jsonError("Verification draft limit reached. Try again later.", 429);
  }
  const parsed = organizationVerificationDraftSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Check the verification draft.",
    );
  }
  try {
    return Response.json({
      verification: await saveOrganizationVerificationDraft(
        user,
        organizationId,
        parsed.data,
        getRequestMeta(request),
      ),
    });
  } catch (error) {
    return organizationApiFailure("organizations.verification.save", error);
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const organizationId = (await params).id;
  if (
    !(
      await rateLimit(
        `organization-verification:${organizationId}:${user.id}`,
        10,
        24 * 60 * 60_000,
      )
    ).allowed
  ) {
    return jsonError("Verification submission limit reached.", 429);
  }
  const parsed = organizationVerificationSubmitSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Complete the verification request.",
    );
  }
  try {
    return Response.json({
      verification: await submitOrganizationVerification(
        user,
        organizationId,
        parsed.data,
        getRequestMeta(request),
      ),
    });
  } catch (error) {
    return organizationApiFailure("organizations.verification.submit", error);
  }
}
