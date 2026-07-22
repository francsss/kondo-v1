import { NextRequest } from "next/server";
import { academicTermSchema } from "@/features/student-hub/schemas";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { writeAuditLogWithClient } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ universityId: string }> },
) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("STUDENT_HUB_CONFIG_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = academicTermSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid semester." },
      { status: 400 },
    );
  const universityId = (await params).universityId;
  try {
    if (
      parsed.data.campusId &&
      !(await prisma.campus.findFirst({
        where: { id: parsed.data.campusId, universityId },
        select: { id: true },
      }))
    )
      return adminJson(
        { error: "Campus does not belong to this university." },
        { status: 400 },
      );
    const term = await prisma.$transaction(async (tx) => {
      const created = await tx.academicTerm.create({
        data: {
          universityId,
          ...parsed.data,
          startsOn: new Date(`${parsed.data.startsOn}T00:00:00.000Z`),
          endsOn: new Date(`${parsed.data.endsOn}T00:00:00.000Z`),
          firstWeekStartsOn: new Date(
            `${parsed.data.firstWeekStartsOn}T00:00:00.000Z`,
          ),
        },
      });
      await writeAuditLogWithClient(tx, {
        actorId: auth.user.id,
        action: "STUDENT_HUB_TERM_CREATED",
        entityType: "AcademicTerm",
        entityId: created.id,
        newValue: { ...parsed.data },
        ...getRequestMeta(request),
      });
      return created;
    });
    return adminJson({ term }, { status: 201 });
  } catch (error) {
    return adminInternalError("admin.student-hub.term.create", error);
  }
}
