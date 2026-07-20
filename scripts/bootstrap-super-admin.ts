import { prisma } from "../src/lib/prisma";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const confirmed = process.argv.includes("--confirm");
  if (!email || !confirmed) {
    throw new Error(
      "Usage: npm run admin:bootstrap -- admin@your-domain.com --confirm",
    );
  }

  const target = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      role: true,
      status: true,
    },
  });
  if (!target) throw new Error("The target account does not exist.");
  if (target.status !== "ACTIVE") {
    throw new Error("The target account must be active.");
  }
  if (!target.emailVerifiedAt) {
    throw new Error("The target account must verify its email first.");
  }
  if (target.role === "SUPER_ADMIN") {
    process.stdout.write("The account is already a Super Admin.\n");
    return;
  }

  const existingSuperAdmins = await prisma.user.count({
    where: { role: "SUPER_ADMIN", status: "ACTIVE" },
  });
  if (existingSuperAdmins > 0) {
    throw new Error(
      "An active Super Admin already exists. Use the reviewed Admin process instead of bootstrap.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: { role: "SUPER_ADMIN" },
    });
    await tx.session.deleteMany({ where: { userId: target.id } });
    await tx.auditLog.create({
      data: {
        action: "SUPER_ADMIN_BOOTSTRAPPED",
        entityType: "User",
        entityId: target.id,
        oldValue: { role: target.role },
        newValue: { role: "SUPER_ADMIN", sessionsRevoked: true },
      },
    });
  });

  process.stdout.write(
    `Bootstrapped ${target.email} as the first Super Admin. Sign in again.\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Bootstrap failed."}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
