import { NextRequest } from "next/server";
import { listOrganizationApplications } from "@/lib/opportunity-application-review";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const search = request.nextUrl.searchParams;
    return Response.json({
      items: await listOrganizationApplications({
        userId: user.id,
        organizationId: (await params).id,
        opportunityId: search.get("opportunityId"),
        status: search.get("status"),
      }),
    });
  } catch (error) {
    return opportunityApiFailure("organizations.applications.list", error);
  }
}
