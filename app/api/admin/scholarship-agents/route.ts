import { NextRequest } from "next/server";
import { scholarshipAgentInputSchema } from "@/features/scholarships/schemas";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { createScholarshipAgent, ScholarshipError } from "@/lib/scholarships";

export async function GET() {
  const auth = await authorizeAdminApi("STUDENT_HUB_CONFIG_VIEW");
  if (!auth.authorized) return auth.error;
  try {
    return adminJson({
      agents: await prisma.scholarshipAgent.findMany({
        include: { country: { select: { id: true, name: true } } },
        orderBy: [{ isActive: "desc" }, { verified: "desc" }, { name: "asc" }],
      }),
    });
  } catch (error) {
    return adminInternalError("admin.scholarship-agents.list", error);
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("STUDENT_HUB_CONFIG_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = scholarshipAgentInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid agent profile." },
      { status: 400 },
    );
  }
  try {
    return adminJson(
      await createScholarshipAgent({
        actor: auth.user,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ScholarshipError)
      return adminJson({ error: error.message }, { status: error.status });
    return adminInternalError("admin.scholarship-agents.create", error);
  }
}
