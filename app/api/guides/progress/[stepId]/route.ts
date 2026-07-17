import { NextRequest } from "next/server";
import { publishedGuideStepWhere } from "@/lib/content-visibility";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ stepId: string }> };

export async function PUT(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const { stepId } = await params;
  const step = await prisma.guideStep.findFirst({
    where: { id: stepId, ...publishedGuideStepWhere },
    select: { id: true },
  });
  if (!step) return jsonError("Guide step not found.", 404);

  const progress = await prisma.guideProgress.upsert({
    where: { userId_stepId: { userId: user.id, stepId } },
    create: { userId: user.id, stepId },
    update: { completedAt: new Date() },
    select: { id: true },
  });
  return Response.json({ completed: Boolean(progress.id) });
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const { stepId } = await params;
  const step = await prisma.guideStep.findFirst({
    where: { id: stepId, ...publishedGuideStepWhere },
    select: { id: true },
  });
  if (!step) return jsonError("Guide step not found.", 404);

  await prisma.guideProgress.deleteMany({ where: { userId: user.id, stepId } });
  return new Response(null, { status: 204 });
}
