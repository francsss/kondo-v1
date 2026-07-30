import { NextRequest } from "next/server";
import { listOrganizationTeam } from "@/lib/organization-invitations";
import { organizationApiFailure } from "@/lib/organization-api";
import { jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    return Response.json(
      await listOrganizationTeam(user.id, (await params).id),
    );
  } catch (error) {
    return organizationApiFailure("organizations.team.list", error);
  }
}
