import { NextRequest } from "next/server";
import { organizationApiFailure } from "@/lib/organization-api";
import {
  getOrganizationPublicProfileManagement,
  updateOrganizationPublicProfile,
} from "@/lib/organization-public-profile";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { organizationPublicProfileUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    return Response.json(
      await getOrganizationPublicProfileManagement(user, (await params).id),
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie",
        },
      },
    );
  } catch (error) {
    return organizationApiFailure("organizations.public-profile.read", error);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = organizationPublicProfileUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Check the public profile.",
    );
  }
  try {
    return Response.json(
      await updateOrganizationPublicProfile(
        user,
        (await params).id,
        parsed.data,
        getRequestMeta(request),
      ),
    );
  } catch (error) {
    return organizationApiFailure("organizations.public-profile.update", error);
  }
}
