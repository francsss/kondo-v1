import { NextRequest } from "next/server";
import { z } from "zod";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { StudyEssentialError } from "@/lib/study-essentials";
import { createAnnotation, createBookmark } from "@/lib/study-reading";

/**
 * Highlights, notes and bookmarks share a route because they share a locator
 * and an entitlement check. What differs is only which table the row lands in.
 */

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("annotation"),
    locator: z.string().trim().min(1).max(600),
    selectedText: z.string().trim().max(2000).optional().nullable(),
    body: z.string().trim().max(4000).optional().nullable(),
    color: z.string().trim().max(20).optional().nullable(),
  }),
  z.object({
    kind: z.literal("bookmark"),
    locator: z.string().trim().min(1).max(600),
    label: z.string().trim().max(300).optional().nullable(),
  }),
]);

type Context = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid annotation.");
  }

  const { slug } = await params;
  try {
    if (parsed.data.kind === "bookmark") {
      const bookmark = await createBookmark({
        userId: user.id,
        slug,
        locator: parsed.data.locator,
        label: parsed.data.label,
      });
      return Response.json({ bookmark }, { status: 201 });
    }

    const note = await createAnnotation({
      userId: user.id,
      slug,
      locator: parsed.data.locator,
      selectedText: parsed.data.selectedText,
      body: parsed.data.body,
      color: parsed.data.color,
    });
    return Response.json({ note }, { status: 201 });
  } catch (error) {
    if (error instanceof StudyEssentialError)
      return jsonError(error.message, error.status);
    return internalApiError("study.annotations.create", error);
  }
}
