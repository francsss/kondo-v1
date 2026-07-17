import { NextRequest } from "next/server";
import {
  cancelAccountRequest,
  ProfileError,
} from "@/lib/profiles";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { accountRequestCancelSchema } from "@/lib/validation";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = accountRequestCancelSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid cancellation request.",
    );
  }
  try {
    const accountRequest = await cancelAccountRequest(
      user,
      (await params).id,
      parsed.data.expectedVersion,
      getRequestMeta(request),
    );
    return Response.json({ request: accountRequest });
  } catch (error) {
    if (error instanceof ProfileError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("account.requests.cancel", error);
  }
}
