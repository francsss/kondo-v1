import type { MediaPurpose, MediaStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { listAdminMedia, MediaError } from "@/lib/media";

const STATUSES = ["PENDING", "PROCESSING", "ACTIVE", "REJECTED", "REMOVED"];
const PURPOSES = [
  "PROFILE_AVATAR",
  "COMMUNITY_COVER",
  "POST_IMAGE",
  "LISTING_IMAGE",
  "GUIDE_COVER",
  "MESSAGE_IMAGE",
  "MESSAGE_DOCUMENT",
];

export async function GET(request: NextRequest) {
  const auth = await authorizeAdminApi("MEDIA_VIEW");
  if (!auth.authorized) return auth.error;
  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const purpose = params.get("purpose");
  try {
    return adminJson(
      await listAdminMedia(auth.user, {
        page: Number(params.get("page") ?? 1),
        pageSize: Number(params.get("pageSize") ?? 25),
        query: params.get("q")?.trim() || undefined,
        status: STATUSES.includes(status ?? "")
          ? (status as MediaStatus)
          : undefined,
        purpose: PURPOSES.includes(purpose ?? "")
          ? (purpose as MediaPurpose)
          : undefined,
      }),
    );
  } catch (error) {
    if (error instanceof MediaError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.media.list", error);
  }
}
