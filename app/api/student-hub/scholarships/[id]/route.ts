import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

const statusSchema = z.object({
  status: z
    .enum([
      "SAVED",
      "PREPARING",
      "APPLIED",
      "INTERVIEW",
      "ACCEPTED",
      "REJECTED",
    ])
    .default("SAVED"),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = statusSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return jsonError("Invalid application status.");
  const scholarshipId = (await params).id;
  try {
    const scholarship = await prisma.scholarship.findFirst({
      where: { id: scholarshipId, isActive: true },
      select: { id: true },
    });
    if (!scholarship) return jsonError("Scholarship not found.", 404);
    const favorite = await prisma.scholarshipFavorite.upsert({
      where: { userId_scholarshipId: { userId: user.id, scholarshipId } },
      create: { userId: user.id, scholarshipId, status: parsed.data.status },
      update: { status: parsed.data.status },
    });
    return Response.json({ favorite });
  } catch (error) {
    return internalApiError("student-hub.scholarship.save", error);
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
    await prisma.scholarshipFavorite.deleteMany({
      where: { userId: user.id, scholarshipId: (await params).id },
    });
    return Response.json({ deleted: true });
  } catch (error) {
    return internalApiError("student-hub.scholarship.remove", error);
  }
}
