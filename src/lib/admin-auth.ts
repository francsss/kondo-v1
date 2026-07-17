import type { AdminPermission } from "@/lib/authorization";
import { hasAdminPermission } from "@/lib/authorization";
import { logServerError } from "@/lib/logger";
import { getCurrentUser } from "@/lib/server-auth";

export function adminJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Vary", "Cookie");
  return Response.json(body, { ...init, headers });
}

export function adminInternalError(event: string, error: unknown) {
  logServerError(event, error);
  return adminJson(
    { error: "An unexpected server error occurred." },
    { status: 500 },
  );
}

export async function authorizeAdminApi(permission: AdminPermission) {
  const user = await getCurrentUser();
  if (!user) {
    return {
      authorized: false,
      error: adminJson({ error: "Authentication required." }, { status: 401 }),
    } as const;
  }
  if (!hasAdminPermission(user.role, permission)) {
    return {
      authorized: false,
      error: adminJson({ error: "Access denied." }, { status: 403 }),
    } as const;
  }
  return { authorized: true, user } as const;
}
