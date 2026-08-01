import { z } from "zod";
import type { NextRequest } from "next/server";
import {
  getUserJourney,
  JourneyError,
  updateUserJourney,
} from "@/lib/journey-service";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/server-auth";

const schema = z.object({
  group: z.enum([
    "PREPARING_FOR_CHINA",
    "STUDYING_AND_LIVING_IN_CHINA",
    "CAREER_ALUMNI_AND_ENTREPRENEURSHIP",
  ]),
  stage: z.enum([
    "EXPLORING",
    "PREPARING_APPLICATION",
    "APPLICATION_SUBMITTED",
    "WAITING_FOR_DECISION",
    "ADMITTED",
    "PREPARING_ARRIVAL",
    "NEW_ARRIVAL",
    "CURRENT_STUDENT",
    "INTERNSHIP_PREPARATION",
    "FINAL_YEAR",
    "GRADUATING",
    "JOB_SEEKING",
    "EMPLOYED",
    "ALUMNI",
    "PROFESSIONAL",
    "ENTREPRENEUR",
  ]),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!(await rateLimit(`journey:${user.id}`, 20, 24 * 60 * 60_000)).allowed) {
    return jsonError("Too many journey updates. Please try again later.", 429);
  }
  return Response.json({ journey: await getUserJourney(user.id) });
}

export async function PATCH(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid journey.");
  try {
    return Response.json({
      journey: await updateUserJourney({ userId: user.id, ...parsed.data }),
    });
  } catch (error) {
    if (error instanceof JourneyError)
      return jsonError(error.message, error.status);
    return internalApiError("journey.update", error);
  }
}
