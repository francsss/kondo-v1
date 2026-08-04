import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { StudyEssentialError } from "@/lib/study-essentials";
import { saveReadingProgress } from "@/lib/study-workspace";

const progressSchema = z.object({
  slug: z.string().trim().min(1).max(180),
  chapterId: z.string().cuid(),
});

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  const parsed = progressSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid reading position.");

  try {
    const essential = await prisma.studyEssential.findFirst({
      where: { slug: parsed.data.slug, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!essential) return jsonError("Unknown resource.", 404);
    const progress = await saveReadingProgress({
      userId: user.id,
      essentialId: essential.id,
      chapterId: parsed.data.chapterId,
    });
    return Response.json({ ok: true, progress });
  } catch (error) {
    if (error instanceof StudyEssentialError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("studyWorkspace.progress", error);
  }
}
