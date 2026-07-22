import { NextRequest } from "next/server";
import { scheduleCreateSchema } from "@/features/student-hub/schemas";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = scheduleCreateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid timetable.");
  try {
    const schedule = await prisma.studentSchedule.create({
      data: { ownerId: user.id, ...parsed.data, confirmedAt: new Date() },
    });
    return Response.json({ schedule }, { status: 201 });
  } catch (error) {
    return internalApiError("student-hub.schedule.create", error);
  }
}
