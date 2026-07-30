import { NextRequest } from "next/server";
import { getOrganizationPublicProfile } from "@/lib/organization-public-profile";
import { internalApiError, jsonError } from "@/lib/request";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const result = await getOrganizationPublicProfile((await params).slug);
    if (!result) {
      return jsonError("Organization not found.", 404);
    }
    if (result.redirectSlug) {
      return Response.redirect(
        new URL(
          `/api/organizations/public/${result.redirectSlug}`,
          request.url,
        ),
        308,
      );
    }
    return Response.json(
      { organization: result.profile },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    return internalApiError("organizations.public.read", error);
  }
}
