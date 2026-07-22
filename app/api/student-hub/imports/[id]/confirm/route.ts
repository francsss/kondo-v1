import { NextRequest } from "next/server";
import { scheduleImportConfirmSchema } from "@/features/student-hub/schemas";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import {
  cleanupScheduleImportSources,
  saveScheduleImport,
  ScheduleImportStateError,
} from "@/lib/schedule-import";
import { getCurrentUser } from "@/lib/server-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = scheduleImportConfirmSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid timetable.");
  const id = (await params).id;
  try {
    const saved = await saveScheduleImport({
      importId: id,
      ownerId: user.id,
      expectedStatus: "REVIEW_REQUIRED",
      title: parsed.data.title,
      courses: parsed.data.courses,
      requestMeta: getRequestMeta(request),
    });
    await cleanupScheduleImportSources({
      actor: user,
      importId: id,
      files: saved.files,
      retainSource: saved.retainSource,
      requestMeta: getRequestMeta(request),
    });
    return Response.json(
      { schedule: saved.schedule, conflicts: saved.conflicts },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ScheduleImportStateError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("student-hub.import.confirm", error);
  }
}
