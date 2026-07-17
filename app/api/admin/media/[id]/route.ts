import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { getAdminMedia, MediaError, removeMediaAsAdmin } from "@/lib/media";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { mediaAdminRemoveSchema } from "@/lib/validation";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeAdminApi("MEDIA_VIEW");
  if (!auth.authorized) return auth.error;
  try {
    return adminJson({
      result: await getAdminMedia(auth.user, (await params).id),
    });
  } catch (error) {
    if (error instanceof MediaError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.media.detail", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("MEDIA_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = mediaAdminRemoveSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      {
        error:
          parsed.error.issues[0]?.message ?? "A removal reason is required.",
      },
      { status: 400 },
    );
  }
  try {
    return adminJson(
      await removeMediaAsAdmin(
        auth.user,
        (await params).id,
        parsed.data.reason,
        getRequestMeta(request),
      ),
    );
  } catch (error) {
    if (error instanceof MediaError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.media.remove", error);
  }
}
