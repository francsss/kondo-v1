import { NextRequest } from "next/server";
import { adminInternalError, adminJson, authorizeAdminApi } from "@/lib/admin-auth";
import { CommunityError, getAdminCommunity, updateCommunityAsAdmin } from "@/lib/communities";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { adminCommunityUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Context) {
  const auth = await authorizeAdminApi("COMMUNITY_CMS_VIEW");
  if (!auth.authorized) return auth.error;
  try {
    const community = await getAdminCommunity(auth.user, (await params).id);
    if (!community) return adminJson({ error: "Community not found." }, { status: 404 });
    return adminJson({ community });
  } catch (error) {
    if (error instanceof CommunityError) return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.communities.detail", error);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request)) return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("COMMUNITY_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = adminCommunityUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return adminJson({ error: "Invalid community update." }, { status: 400 });
  try {
    return adminJson(await updateCommunityAsAdmin({
      actor: auth.user,
      communityId: (await params).id,
      ...parsed.data,
      meta: getRequestMeta(request),
    }));
  } catch (error) {
    if (error instanceof CommunityError) return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.communities.update", error);
  }
}
