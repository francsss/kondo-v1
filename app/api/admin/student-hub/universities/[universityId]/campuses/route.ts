import { NextRequest } from "next/server";
import { campusSchema } from "@/features/student-hub/schemas";
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
  const parsed = campusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid campus." },
      { status: 400 },
    );
  const universityId = (await params).universityId;
  try {
    const campus = await prisma.$transaction(async (tx) => {
      const created = await tx.campus.create({
        data: { universityId, ...parsed.data },
      });
      await writeAuditLogWithClient(tx, {
        actorId: auth.user.id,
        action: "STUDENT_HUB_CAMPUS_CREATED",
        entityType: "Campus",
        entityId: created.id,
        newValue: parsed.data,
        ...getRequestMeta(request),
      });
      return created;
    });
    return adminJson({ campus }, { status: 201 });
  } catch (error) {
    return adminInternalError("admin.student-hub.campus.create", error);
  }
}
