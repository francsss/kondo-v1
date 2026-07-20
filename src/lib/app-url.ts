export function getAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      throw new Error("NEXT_PUBLIC_APP_URL must be a valid absolute URL.");
    }
  }
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    throw new Error("NEXT_PUBLIC_APP_URL is required in production.");
  }
  return "http://localhost:3000";
}
