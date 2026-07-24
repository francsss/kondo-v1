import { NextResponse } from "next/server";
import { presenceStore } from "@/lib/presence";
import { internalApiError } from "@/lib/request";
import { requireAdminPermission } from "@/lib/server-auth";

export async function GET() {
  await requireAdminPermission("ANALYTICS_VIEW");
  try {
    const users = await presenceStore.listOnline();
    return NextResponse.json(
      { users, generatedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie",
        },
      },
    );
  } catch (error) {
    return internalApiError("admin.presence.list", error);
  }
}
