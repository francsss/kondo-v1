import { NextResponse } from "next/server";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { presenceStore } from "@/lib/presence";
import { internalApiError } from "@/lib/request";

export async function GET() {
  const auth = await authorizeAdminApi("ANALYTICS_VIEW");
  if (!auth.authorized) return auth.error;
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
