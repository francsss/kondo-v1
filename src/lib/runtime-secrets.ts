const DEVELOPMENT_JWT_SECRET = "dev-only-kondo-secret-change-me-before-launch";

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    if (new TextEncoder().encode(secret).byteLength < 32) {
      throw new Error("JWT_SECRET must contain at least 32 bytes.");
    }
    return secret;
  }
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    throw new Error("JWT_SECRET is required in production.");
  }
  return DEVELOPMENT_JWT_SECRET;
}
