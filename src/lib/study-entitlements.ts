import type {
  Prisma,
  StudyEntitlementSource,
  StudyEssential,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Whether a member may open a title, and the one place that decides it.
 *
 * Every protected surface — the asset URL, reading progress, notes,
 * highlights, bookmarks, the assistant — asks this rather than deciding for
 * itself, so there is a single definition of "owns" to audit and a single
 * place to change when licences gain terms.
 *
 * A hidden button is not access control. Nothing here trusts the client:
 * the caller supplies a user id from the session and a slug, and the answer
 * comes from the database.
 */

export type EntitlementCheck =
  | { allowed: true; reason: "ENTITLED" | "FREE" }
  | { allowed: false; reason: "NO_ENTITLEMENT" | "EXPIRED" | "UNAVAILABLE" };

/**
 * A title nobody has to buy.
 *
 * The pilot book is public domain and priced at zero, and a member should not
 * have to complete a payment to read something Kondo is giving away. Priced
 * titles never take this path.
 */
export function isFreeTitle(essential: {
  priceMinor: number | null;
  source: StudyEssential["source"];
}) {
  return essential.source === "KONDO" && (essential.priceMinor ?? 0) === 0;
}

export async function checkEntitlement(input: {
  userId: string;
  essentialId: string;
  now?: Date;
}): Promise<EntitlementCheck> {
  const now = input.now ?? new Date();
  const essential = await prisma.studyEssential.findUnique({
    where: { id: input.essentialId },
    select: { id: true, status: true, priceMinor: true, source: true },
  });
  // An archived or draft title is not readable even by someone who bought it
  // while it was published; withdrawal is a deliberate act.
  if (!essential || essential.status !== "PUBLISHED") {
    return { allowed: false, reason: "UNAVAILABLE" };
  }

  const entitlement = await prisma.studyEntitlement.findUnique({
    where: {
      userId_essentialId: {
        userId: input.userId,
        essentialId: input.essentialId,
      },
    },
    select: { status: true, expiresAt: true },
  });

  if (entitlement && entitlement.status === "ACTIVE") {
    if (entitlement.expiresAt && entitlement.expiresAt <= now) {
      return { allowed: false, reason: "EXPIRED" };
    }
    return { allowed: true, reason: "ENTITLED" };
  }
  if (entitlement && entitlement.status === "EXPIRED") {
    return { allowed: false, reason: "EXPIRED" };
  }
  // A revoked entitlement is not upgraded to free access by a later price
  // change, so the revocation is checked before the free-title path.
  if (entitlement && entitlement.status === "REVOKED") {
    return { allowed: false, reason: "NO_ENTITLEMENT" };
  }

  if (isFreeTitle(essential)) return { allowed: true, reason: "FREE" };
  return { allowed: false, reason: "NO_ENTITLEMENT" };
}

/**
 * Grant access exactly once.
 *
 * The unique index on (userId, essentialId) is what makes this safe under a
 * replayed payment notification: the second call updates the row the first one
 * created rather than adding a second grant. It is written to be callable
 * inside the transaction that marks an order paid, so an entitlement can never
 * exist without its order having been settled in the same commit.
 */
export async function grantEntitlement(
  client: Prisma.TransactionClient,
  input: {
    userId: string;
    essentialId: string;
    source: StudyEntitlementSource;
    orderId?: string | null;
    expiresAt?: Date | null;
  },
) {
  return client.studyEntitlement.upsert({
    where: {
      userId_essentialId: {
        userId: input.userId,
        essentialId: input.essentialId,
      },
    },
    // Re-granting restores access that was revoked or allowed to expire, and
    // re-points the grant at the order that paid for it. It never moves a
    // grant backwards into a non-active state.
    update: {
      status: "ACTIVE",
      source: input.source,
      orderId: input.orderId ?? undefined,
      expiresAt: input.expiresAt ?? null,
    },
    create: {
      userId: input.userId,
      essentialId: input.essentialId,
      source: input.source,
      orderId: input.orderId ?? null,
      expiresAt: input.expiresAt ?? null,
    },
  });
}

/**
 * The titles a member may open, for My Books.
 *
 * Bought and granted titles come from entitlements. Free titles have no
 * entitlement row — nothing was ever transacted — so a member who started
 * reading one would find it stuck under "Available" with no sign of their
 * progress, and no way back to where they left off. A free title a member has
 * actually opened is theirs in every sense that matters here, so reading
 * progress is treated as the second way onto this shelf.
 */
export async function listEntitledEssentials(userId: string) {
  const entitlements = await prisma.studyEntitlement.findMany({
    where: {
      userId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      essential: { status: "PUBLISHED" },
    },
    orderBy: { grantedAt: "desc" },
    select: {
      grantedAt: true,
      expiresAt: true,
      source: true,
      essential: {
        select: {
          id: true,
          slug: true,
          title: true,
          author: true,
          coverEmoji: true,
          imageUrl: true,
          deliveryType: true,
          category: true,
        },
      },
    },
  });

  // Progress is read in one query rather than per title, so My Books stays a
  // fixed number of round trips however many books a member owns. It doubles
  // as the shelf's second source: a started free title appears here too.
  const progress = await prisma.studyReadingProgress.findMany({
    where: { userId },
    select: {
      essentialId: true,
      percentage: true,
      lastReadAt: true,
      essential: {
        select: {
          id: true,
          slug: true,
          title: true,
          author: true,
          coverEmoji: true,
          imageUrl: true,
          deliveryType: true,
          category: true,
          status: true,
          priceMinor: true,
          source: true,
        },
      },
    },
  });
  const byEssential = new Map(progress.map((row) => [row.essentialId, row]));

  const owned = entitlements.map((row) => ({
    ...row.essential,
    grantedAt: row.grantedAt,
    source: row.source,
    percentage: byEssential.get(row.essential.id)?.percentage ?? 0,
    lastReadAt: byEssential.get(row.essential.id)?.lastReadAt ?? null,
  }));

  const ownedIds = new Set(owned.map((book) => book.id));
  const startedFree = progress
    .filter(
      (row) =>
        !ownedIds.has(row.essentialId) &&
        row.essential.status === "PUBLISHED" &&
        isFreeTitle(row.essential),
    )
    .map((row) => ({
      id: row.essential.id,
      slug: row.essential.slug,
      title: row.essential.title,
      author: row.essential.author,
      coverEmoji: row.essential.coverEmoji,
      imageUrl: row.essential.imageUrl,
      deliveryType: row.essential.deliveryType,
      category: row.essential.category,
      grantedAt: row.lastReadAt,
      source: "PILOT" as StudyEntitlementSource,
      percentage: row.percentage ?? 0,
      lastReadAt: row.lastReadAt,
    }));

  // Most recently touched first, so the book someone is in the middle of is
  // the one at the top of the shelf.
  return [...owned, ...startedFree].sort(
    (a, b) =>
      (b.lastReadAt ?? b.grantedAt ?? new Date(0)).getTime() -
      (a.lastReadAt ?? a.grantedAt ?? new Date(0)).getTime(),
  );
}
