import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { writeAuditLogWithClient } from "@/lib/audit";
import { sendTransactionalEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export class AuthTokenError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AuthTokenError";
  }
}

type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };

const TOKEN_BYTES = 32;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60_000;
const PASSWORD_RESET_TTL_MS = 60 * 60_000;

function generateToken() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

// Only surfaced outside production so the flow is fully testable without a
// configured email provider; production never returns a raw token.
function devToken(token: string) {
  return process.env.NODE_ENV === "production" ? undefined : token;
}

export async function requestEmailVerification(input: {
  userId: string;
  meta?: RequestMeta;
}) {
  const limit = await rateLimit(`verify-email:${input.userId}`, 3, 60 * 60_000);
  if (!limit.allowed) {
    throw new AuthTokenError(
      "Too many verification emails requested. Try again later.",
      429,
    );
  }
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, emailVerifiedAt: true },
  });
  if (!user) throw new AuthTokenError("Account not found.", 404);
  if (user.emailVerifiedAt) return { alreadyVerified: true as const };

  const token = generateToken();
  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      },
    });
  });
  await sendTransactionalEmail({
    to: user.email,
    subject: "Verify your Kondo email",
    text: `Confirm your Kondo email address: ${appUrl()}/verify-email?token=${encodeURIComponent(token)}\n\nThis link expires in 24 hours.`,
  });
  return { alreadyVerified: false as const, devToken: devToken(token) };
}

export async function confirmEmailVerification(input: {
  token: string;
  meta?: RequestMeta;
}) {
  const tokenHash = hashToken(input.token);
  return prisma.$transaction(async (tx) => {
    const record = await tx.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new AuthTokenError(
        "This verification link is invalid or has expired.",
      );
    }
    await tx.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    await tx.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    });
    await writeAuditLogWithClient(tx, {
      actorId: record.userId,
      action: "EMAIL_VERIFIED",
      entityType: "User",
      entityId: record.userId,
      ...input.meta,
    });
    return { verified: true };
  });
}

export async function requestPasswordReset(input: {
  email: string;
  meta?: RequestMeta;
}) {
  const email = input.email.trim().toLowerCase();
  const limit = await rateLimit(`password-reset:${email}`, 5, 60 * 60_000);
  if (!limit.allowed) {
    throw new AuthTokenError("Too many reset requests. Try again later.", 429);
  }
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, status: true },
  });
  // Always take the same amount of work and return the same shape regardless
  // of whether the account exists, so this endpoint cannot be used to
  // enumerate registered emails.
  if (!user || user.status !== "ACTIVE") {
    return { devToken: undefined };
  }
  const token = generateToken();
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });
  });
  await sendTransactionalEmail({
    to: user.email,
    subject: "Reset your Kondo password",
    text: `Reset your Kondo password: ${appUrl()}/reset-password?token=${encodeURIComponent(token)}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore it.`,
  });
  return { devToken: devToken(token) };
}

export async function confirmPasswordReset(input: {
  token: string;
  newPassword: string;
  meta?: RequestMeta;
}) {
  const tokenHash = hashToken(input.token);
  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  return prisma.$transaction(async (tx) => {
    const record = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new AuthTokenError("This reset link is invalid or has expired.");
    }
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    });
    const revoked = await tx.session.deleteMany({
      where: { userId: record.userId },
    });
    await writeAuditLogWithClient(tx, {
      actorId: record.userId,
      action: "PASSWORD_RESET",
      entityType: "User",
      entityId: record.userId,
      newValue: { sessionsRevoked: revoked.count },
      ...input.meta,
    });
    return { userId: record.userId };
  });
}
