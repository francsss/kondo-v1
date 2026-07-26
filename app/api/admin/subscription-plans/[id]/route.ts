import { NextRequest } from "next/server";
import { z } from "zod";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/request";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(500),
  active: z.boolean(),
  priceMinor: z.number().int().min(0).nullable(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase()),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]),
  featureKeys: z.array(z.string().trim().min(2).max(100)).max(30),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("PLATFORM_SETTINGS_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return adminJson(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Invalid subscription plan update.",
      },
      { status: 400 },
    );
  }
  try {
    const plan = await prisma.subscriptionPlan.update({
      where: { id: (await params).id },
      data: parsed.data,
    });
    return adminJson({ plan });
  } catch (error) {
    return adminInternalError("admin.subscription-plan.update", error);
  }
}
