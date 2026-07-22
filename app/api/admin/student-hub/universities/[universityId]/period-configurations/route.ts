import { NextRequest } from "next/server";
import { periodConfigurationSchema } from "@/features/student-hub/schemas";
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
  const parsed = periodConfigurationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return adminJson(
      {
        error:
          parsed.error.issues[0]?.message ?? "Invalid period configuration.",
      },
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
    const configuration = await prisma.$transaction(async (tx) => {
      if (parsed.data.isDefault)
        await tx.universityPeriodConfiguration.updateMany({
          where: {
            universityId,
            campusId: parsed.data.campusId ?? null,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      const created = await tx.universityPeriodConfiguration.create({
        data: {
          universityId,
          campusId: parsed.data.campusId ?? null,
          name: parsed.data.name,
          timezone: parsed.data.timezone,
          primaryLanguage: parsed.data.primaryLanguage,
          isActive: parsed.data.isActive,
          isDefault: parsed.data.isDefault,
          periods: { create: parsed.data.periods },
        },
        include: { periods: { orderBy: { displayOrder: "asc" } } },
      });
      await writeAuditLogWithClient(tx, {
        actorId: auth.user.id,
        action: "STUDENT_HUB_PERIOD_CONFIG_CREATED",
        entityType: "UniversityPeriodConfiguration",
        entityId: created.id,
        newValue: {
          universityId,
          campusId: created.campusId,
          name: created.name,
          periodCount: created.periods.length,
          isDefault: created.isDefault,
        },
        ...getRequestMeta(request),
      });
      return created;
    });
    return adminJson({ configuration }, { status: 201 });
  } catch (error) {
    return adminInternalError("admin.student-hub.period-config.create", error);
  }
}
