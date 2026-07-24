import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { StoryError, updateStoryCreatorStatus } from "@/lib/stories";
import { storyCreatorStatusSchema } from "@/lib/story-validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("STORY_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = storyCreatorStatusSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid creator status." },
      { status: 400 },
    );
  }
  try {
    return adminJson(
      await updateStoryCreatorStatus(
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
    return adminInternalError("admin.stories.creator.update", error);
  }
}
