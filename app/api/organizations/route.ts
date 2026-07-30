import { NextRequest } from "next/server";
import {
  createOrganizationDraft,
  listManagedOrganizations,
  OrganizationError,
} from "@/lib/organizations";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { organizationDraftCreateSchema } from "@/lib/validation";

function failure(event: string, error: unknown) {
  if (error instanceof OrganizationError) {
    return jsonError(error.message, error.status);
  }
  return internalApiError(event, error);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    return Response.json({
      organizations: await listManagedOrganizations(user.id),
    });
  } catch (error) {
    return failure("organizations.list", error);
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`organization-create:${user.id}`, 10, 24 * 60 * 60_000))
      .allowed
  ) {
    return jsonError(
      "Organization creation limit reached. Try again later.",
      429,
    );
  }
  const parsed = organizationDraftCreateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Check the organization details.",
    );
  }
  try {
    const organization = await createOrganizationDraft(
      user,
      parsed.data,
      getRequestMeta(request),
    );
    return Response.json({ organization }, { status: 201 });
  } catch (error) {
    return failure("organizations.create", error);
  }
}
