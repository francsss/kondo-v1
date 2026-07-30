import { NextRequest } from "next/server";
import { organizationApiFailure } from "@/lib/organization-api";
import { unpublishOrganizationPublicProfile } from "@/lib/organization-publication";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { organizationPublicationSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = organizationPublicationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Confirm unpublishing to continue.");
  try {
    return Response.json(
      await unpublishOrganizationPublicProfile(
        user,
        (await params).id,
        getRequestMeta(request),
      ),
    );
  } catch (error) {
    return organizationApiFailure(
      "organizations.public-profile.unpublish",
      error,
    );
  }
}
