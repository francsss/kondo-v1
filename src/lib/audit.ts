import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  actorId?: string | null;
  organizationId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function writeAuditLog(input: AuditInput) {
  return writeAuditLogWithClient(prisma, input);
}

export async function writeAuditLogWithClient(
  client: Pick<Prisma.TransactionClient, "auditLog">,
  input: AuditInput,
) {
  return client.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      organizationId: input.organizationId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValue: input.oldValue ?? undefined,
      newValue: input.newValue ?? undefined,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
