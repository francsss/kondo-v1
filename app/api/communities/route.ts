import { NextRequest } from "next/server";
import { CommunityError, createCommunity } from "@/lib/communities";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { createCommunitySchema } from "@/lib/validation";

function communityError(event: string, error: unknown) {
  if (error instanceof CommunityError) {
    return jsonError(error.message, error.status);
  }
  return internalApiError(event, error);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const pageSize = Math.min(
    30,
    Math.max(6, Number(params.get("pageSize") ?? 12) || 12),
  );
  const query = params.get("q")?.trim();
  const where = {
    status: "ACTIVE" as const,
    isPrivate: false,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  try {
    const [total, communities] = await Promise.all([
      prisma.community.count({ where }),
      prisma.community.findMany({
        where,
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          type: true,
          icon: true,
          isVerified: true,
          joinPolicy: true,
          coverMediaId: true,
          _count: { select: { members: true, posts: true } },
        },
        orderBy: [
          { isVerified: "desc" },
          { members: { _count: "desc" } },
          { createdAt: "desc" },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return Response.json(
      {
        communities: communities.map((community) => ({
          ...community,
          coverUrl: community.coverMediaId
            ? `/api/media/${community.coverMediaId}`
            : null,
          coverMediaId: undefined,
        })),
        pagination: {
          page,
          pageSize,
          pageCount: Math.max(1, Math.ceil(total / pageSize)),
          total,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    return internalApiError("communities.list", error);
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`community-create:${user.id}`, 3, 24 * 60 * 60_000))
      .allowed
  ) {
    return jsonError("Community creation limit reached.", 429);
  }
  const parsed = createCommunitySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid community.");
  }
  try {
    return Response.json(
      await createCommunity({
        actor: user,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    return communityError("communities.create", error);
  }
}
