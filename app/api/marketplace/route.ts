import { NextRequest } from "next/server";
import {
  createMarketplaceListing,
  MarketplaceError,
} from "@/lib/marketplace";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { createListingSchema } from "@/lib/validation";

function failure(event: string, error: unknown) {
  if (error instanceof MarketplaceError) return jsonError(error.message, error.status);
  return internalApiError(event, error);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const pageSize = Math.min(40, Math.max(8, Number(params.get("pageSize") ?? 20) || 20));
  const minPrice = Number(params.get("minPrice"));
  const maxPrice = Number(params.get("maxPrice"));
  const sort = params.get("sort");
  const query = params.get("q")?.trim();
  const where = {
    status: "ACTIVE" as const,
    expiresAt: { gt: new Date() },
    category: params.get("category")
      ? { slug: params.get("category")!, isActive: true }
      : { isActive: true },
    city: params.get("city") ? { slug: params.get("city")! } : undefined,
    priceFen: {
      gte: Number.isFinite(minPrice) && minPrice >= 0 ? Math.round(minPrice * 100) : undefined,
      lte: Number.isFinite(maxPrice) && maxPrice >= 0 ? Math.round(maxPrice * 100) : undefined,
    },
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const orderBy =
    sort === "price-asc"
      ? ({ priceFen: "asc" } as const)
      : sort === "price-desc"
        ? ({ priceFen: "desc" } as const)
        : sort === "oldest"
          ? ({ publishedAt: "asc" } as const)
          : ({ publishedAt: "desc" } as const);
  try {
    const [total, listings] = await Promise.all([
      prisma.marketplaceListing.count({ where }),
      prisma.marketplaceListing.findMany({
        where,
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          priceFen: true,
          isNegotiable: true,
          publishedAt: true,
          expiresAt: true,
          category: { select: { slug: true, name: true, icon: true } },
          city: { select: { slug: true, name: true } },
          seller: { select: { id: true, firstName: true, lastName: true } },
          images: {
            where: { mediaId: { not: null } },
            orderBy: { order: "asc" },
            take: 1,
            select: { mediaId: true, altText: true },
          },
          _count: { select: { favorites: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return Response.json(
      {
        listings: listings.map((listing) => ({
          ...listing,
          publishedAt: listing.publishedAt?.toISOString() ?? null,
          expiresAt: listing.expiresAt?.toISOString() ?? null,
          image: listing.images[0] ?? null,
          images: undefined,
        })),
        pagination: {
          page,
          pageSize,
          pageCount: Math.max(1, Math.ceil(total / pageSize)),
          total,
        },
      },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
    );
  } catch (error) {
    return internalApiError("marketplace.list", error);
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!rateLimit(`listing:${user.id}`, 10, 24 * 60 * 60_000).allowed) {
    return jsonError("Daily listing limit reached.", 429);
  }
  const parsed = createListingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid listing.");
  }
  try {
    return Response.json(
      await createMarketplaceListing({
        actor: user,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    return failure("marketplace.create", error);
  }
}
