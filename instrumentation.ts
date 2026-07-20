export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.VERCEL_ENV === "production"
  ) {
    const { assertProductionEnvironment } = await import("@/lib/environment");
    assertProductionEnvironment();
  }
}
