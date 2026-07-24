import { NextRequest } from "next/server";
import { scholarshipInputSchema } from "@/features/scholarships/schemas";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { createScholarship, ScholarshipError } from "@/lib/scholarships";

export async function GET() {
  const auth = await authorizeAdminApi("STUDENT_HUB_CONFIG_VIEW");
  if (!auth.authorized) return auth.error;
  try {
    return adminJson({
      scholarships: await prisma.scholarship.findMany({
        include: {
          country: { select: { id: true, name: true } },
          universities: {
            include: { university: { select: { id: true, name: true } } },
          },
        },
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      }),
    });
  } catch (error) {
    return adminInternalError("admin.scholarships.list", error);
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("STUDENT_HUB_CONFIG_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = scholarshipInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      {
        error:
          parsed.error.issues[0]?.message ?? "Invalid scholarship details.",
      },
      { status: 400 },
    );
  }
  try {
    return adminJson(
      await createScholarship({
        actor: auth.user,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ScholarshipError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.scholarships.create", error);
  }
}
