import { paymentCapability } from "@/lib/payments/orchestration";

export async function GET() {
  return Response.json(paymentCapability, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
