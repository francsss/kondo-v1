import { NextRequest } from "next/server";
import { jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const story = await prisma.story.findFirst({
    where: {
      id: (await params).id,
      status: "PUBLISHED",
      publishedAt: { lte: new Date() },
      hiddenBy: { none: { userId: user.id } },
    },
    select: { captions: true, durationSeconds: true },
  });
  if (!story?.captions) return jsonError("Captions were not found.", 404);
  const captions = story.captions.trim();
  const body = captions.startsWith("WEBVTT")
    ? captions
    : `WEBVTT\n\n00:00:00.000 --> 00:${String(
        Math.floor(story.durationSeconds / 60),
      ).padStart(2, "0")}:${String(story.durationSeconds % 60).padStart(
        2,
        "0",
      )}.000\n${captions.replaceAll("-->", "→")}\n`;
  return new Response(body, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Type": "text/vtt; charset=utf-8",
      Vary: "Cookie",
    },
  });
}
