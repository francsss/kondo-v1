import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { studentSkillOfferSchema } from "@/lib/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = studentSkillOfferSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid skill offer.");
  }
  try {
    const result = await prisma.studentSkillOffer.updateMany({
      where: { id: (await params).id, ownerId: user.id, status: "ACTIVE" },
      data: parsed.data,
    });
    if (!result.count) return jsonError("Skill offer not found.", 404);
    return Response.json({ ok: true });
  } catch (error) {
    return internalApiError("marketplace.skills.update", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    const result = await prisma.studentSkillOffer.updateMany({
      where: { id: (await params).id, ownerId: user.id, status: "ACTIVE" },
      data: { status: "CLOSED" },
    });
    if (!result.count) return jsonError("Skill offer not found.", 404);
    return Response.json({ ok: true });
  } catch (error) {
    return internalApiError("marketplace.skills.close", error);
  }
}
