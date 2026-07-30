import { NextRequest } from "next/server";
import { organizationApiFailure } from "@/lib/organization-api";
import { createOrReuseOrganizationReport } from "@/lib/organization-reporting";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { organizationReportSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`organization-report:${user.id}`, 8, 24 * 60 * 60_000))
      .allowed
  ) {
    return jsonError("Report limit reached. Try again later.", 429);
  }
  const parsed = organizationReportSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Check the report.");
  try {
    return Response.json(
      await createOrReuseOrganizationReport({
        actor: user,
        organizationId: (await params).id,
        ...parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    return organizationApiFailure("organizations.report", error);
  }
}
