import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

/**
 * Mark signed-in documents as private to shared caches.
 *
 * `Vary: Cookie` keeps any intermediary from serving one student's signed-in
 * page to another. It is set only for requests that actually carry a session
 * cookie, so public pages keep their caching, and only for documents.
 *
 * Note what this cannot do. `Cache-Control` is deliberately not set here: Next
 * overwrites that particular header on its own rendered app-router responses,
 * so `no-store` cannot be applied from the config or from here. Stopping a
 * signed-out student's history navigation from redisplaying their account is
 * therefore handled in `SessionFreshnessGuard`, which is where the reasoning
 * for that lives.
 *
 * This deliberately does not authenticate anything. Verifying the token here
 * would put a crypto check on every request for no gain: the pages themselves
 * already call `requireUser()`, which is the real gate.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const hasSession = request.cookies.has(AUTH_COOKIE_NAME);
  const isDocument =
    request.headers.get("sec-fetch-dest") === "document" ||
    request.headers.get("accept")?.includes("text/html");

  if (hasSession && isDocument) {
    // Shared caches must not key a signed-in page as if it were public.
    response.headers.set("Vary", "Cookie");
  }

  return response;
}

export const config = {
  /*
   * Documents only. Static assets, image optimizer output and the favicon are
   * excluded so their caching is untouched — this exists to stop a stale
   * *page* being restored, nothing more.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
