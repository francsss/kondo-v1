import { NextRequest } from "next/server";
import { createAccountRequest, listOwnAccountRequests } from "@/lib/profiles";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { accountRequestCreateSchema } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    return Response.json(
      { requests: await listOwnAccountRequests(user.id) },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie",
        },
      },
    );
  } catch (error) {
    return internalApiError("account.requests.list", error);
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`account-request:${user.id}`, 5, 24 * 60 * 60_000))
      .allowed
  ) {
    return jsonError("Account request limit reached. Try again later.", 429);
  }
  const parsed = accountRequestCreateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid account request.",
    );
  }
  try {
    const accountRequest = await createAccountRequest(
      user,
      parsed.data,
      getRequestMeta(request),
    );
    return Response.json({ request: accountRequest }, { status: 201 });
  } catch (error) {
    return internalApiError("account.requests.create", error);
  }
}
