import { NextRequest } from "next/server";
import { expireMarketplaceListings } from "@/lib/marketplace";
import { internalApiError, jsonError } from "@/lib/request";

export async function POST(request: NextRequest) {
  const secret = process.env.MARKETPLACE_WORKER_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return jsonError("Unauthorized.", 401);
  }
  try {
    return Response.json(await expireMarketplaceListings());
  } catch (error) {
    return internalApiError("marketplace.expire", error);
  }
}
