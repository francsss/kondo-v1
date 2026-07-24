import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { StoryError, upsertStoryCategory } from "@/lib/stories";
import { storyCategorySchema } from "@/lib/story-validation";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("STORY_CMS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = storyCategorySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid category." },
      { status: 400 },
    );
  }
  try {
    return adminJson(
      await upsertStoryCategory(
        auth.user,
        parsed.data,
        undefined,
        getRequestMeta(request),
      ),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof StoryError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.stories.category.create", error);
  }
}
