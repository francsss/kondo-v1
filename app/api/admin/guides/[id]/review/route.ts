import { NextRequest } from "next/server";
import { z } from "zod";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import {
  addGuideSource,
  GuideError,
  setGuideContentStatus,
} from "@/lib/guides";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";

/**
 * Content review for a guide: its status, its review date, and its sources.
 *
 * Kept separate from the general guide PATCH because it answers a different
 * question. Editing a guide changes what it says; this changes what Kondo
 * claims about it, and only the latter needs the review permission.
 */

const reviewSchema = z
  .object({
    // Omitted when the editor is only moving the review date, which needs no
    // verification permission.
    status: z
      .enum(["DRAFT", "NEEDS_REVIEW", "VERIFIED", "ARCHIVED"])
      .optional(),
    // Null clears the date; omitted leaves it alone.
    reviewDueAt: z.string().datetime().nullable().optional(),
  })
  .refine(
    (value) => value.status !== undefined || value.reviewDueAt !== undefined,
    { message: "Nothing to change." },
  );

const sourceSchema = z.object({
  title: z.string().trim().min(3).max(300),
  // A citation has to be reachable, or it is decoration.
  url: z.string().trim().url().max(2048),
  organization: z.string().trim().max(200).optional().nullable(),
  isOfficial: z.boolean().optional(),
});

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  // The finer-grained check lives in the service: verifying needs more than
  // managing, and only it knows which transition is being attempted.
  const auth = await authorizeAdminApi("GUIDE_CMS_MANAGE");
  if (!auth.authorized) return auth.error;

  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid review update." },
      { status: 400 },
    );
  }

  try {
    return adminJson(
      await setGuideContentStatus({
        actor: auth.user,
        guideId: (await params).id,
        status: parsed.data.status,
        reviewDueAt:
          parsed.data.reviewDueAt === undefined
            ? undefined
            : parsed.data.reviewDueAt === null
              ? null
              : new Date(parsed.data.reviewDueAt),
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof GuideError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.guides.review", error);
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("GUIDE_CMS_MANAGE");
  if (!auth.authorized) return auth.error;

  const parsed = sourceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid source." },
      { status: 400 },
    );
  }

  try {
    return adminJson(
      await addGuideSource({
        actor: auth.user,
        guideId: (await params).id,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof GuideError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.guides.source.add", error);
  }
}
