import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { StoryError, transitionStoryAsAdmin } from "@/lib/stories";
import { storyAdminTransitionSchema } from "@/lib/story-validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("STORY_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = storyAdminTransitionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid Story update." },
      { status: 400 },
    );
  }
  try {
    return adminJson(
      await transitionStoryAsAdmin(
        auth.user,
        (await params).id,
        parsed.data,
        getRequestMeta(request),
      ),
    );
  } catch (error) {
    if (error instanceof StoryError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.stories.update", error);
  }
}
