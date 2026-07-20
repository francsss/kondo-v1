import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Unauthenticated readiness probe for load balancers, uptime monitors, and
// post-deploy smoke tests. Performs a trivial database round-trip and returns
// 503 if it fails. Intentionally leaks no build, version, or schema detail.
export async function GET() {
  const headers = { "Cache-Control": "no-store, max-age=0" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers });
  } catch {
    return Response.json({ status: "degraded" }, { status: 503, headers });
  }
}
