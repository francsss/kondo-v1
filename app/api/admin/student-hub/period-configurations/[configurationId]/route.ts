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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ configurationId: string }> },
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
      { error: parsed.error.issues[0]?.message ?? "Invalid configuration." },
      { status: 400 },
    );
  const id = (await params).configurationId;
  try {
    const existing = await prisma.universityPeriodConfiguration.findUnique({
      where: { id },
      select: { universityId: true, campusId: true, version: true },
    });
    if (!existing)
      return adminJson({ error: "Configuration not found." }, { status: 404 });
    const configuration = await prisma.$transaction(async (tx) => {
      if (parsed.data.isDefault)
        await tx.universityPeriodConfiguration.updateMany({
          where: {
            universityId: existing.universityId,
            campusId: parsed.data.campusId ?? null,
            isDefault: true,
            id: { not: id },
          },
          data: { isDefault: false },
        });
      await tx.classPeriod.deleteMany({ where: { configurationId: id } });
      const updated = await tx.universityPeriodConfiguration.update({
        where: { id },
        data: {
          campusId: parsed.data.campusId ?? null,
          name: parsed.data.name,
          timezone: parsed.data.timezone,
          primaryLanguage: parsed.data.primaryLanguage,
          isActive: parsed.data.isActive,
          isDefault: parsed.data.isDefault,
          version: { increment: 1 },
          periods: { create: parsed.data.periods },
        },
        include: { periods: { orderBy: { displayOrder: "asc" } } },
      });
      await writeAuditLogWithClient(tx, {
        actorId: auth.user.id,
        action: "STUDENT_HUB_PERIOD_CONFIG_UPDATED",
        entityType: "UniversityPeriodConfiguration",
        entityId: id,
        oldValue: existing,
        newValue: {
          version: updated.version,
          periodCount: updated.periods.length,
          isActive: updated.isActive,
          isDefault: updated.isDefault,
        },
        ...getRequestMeta(request),
      });
      return updated;
    });
    return adminJson({ configuration });
  } catch (error) {
    return adminInternalError("admin.student-hub.period-config.update", error);
  }
}
