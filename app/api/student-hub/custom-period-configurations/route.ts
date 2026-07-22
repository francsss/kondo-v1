import { NextRequest } from "next/server";
import { z } from "zod";
import { classPeriodSchema } from "@/features/student-hub/schemas";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  universityName: z.string().trim().min(2).max(200),
  campusName: z.string().trim().max(160).nullable().optional(),
  timezone: z.string().trim().min(3).max(80).default("Asia/Shanghai"),
  periods: z.array(classPeriodSchema).min(1).max(40),
  submitForReview: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid configuration.",
    );
  try {
    const configuration = await prisma.customPeriodConfiguration.create({
      data: {
        ownerId: user.id,
        name: parsed.data.name,
        universityName: parsed.data.universityName,
        campusName: parsed.data.campusName ?? null,
        timezone: parsed.data.timezone,
        periods: parsed.data.periods,
        submittedForReviewAt: parsed.data.submitForReview ? new Date() : null,
      },
    });
    return Response.json({ configuration }, { status: 201 });
  } catch (error) {
    return internalApiError("student-hub.custom-period.create", error);
  }
}
