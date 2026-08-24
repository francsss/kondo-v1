import type { StudyEssentialDelivery } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  checkEntitlement,
  listEntitledEssentials,
} from "@/lib/study-entitlements";
import { listLibrary } from "@/lib/study-workspace";

/**
 * One answer to "what does this member own, and where does it open".
 *
 * Kondo acquired a second way of owning a title without retiring the first.
 * Orders (`StudyEssentialOrder`) came with the original catalogue; entitlements
 * (`StudyEntitlement`) came with digital books, and only entitlements can
 * express a free pilot title or a grant. Both are real and both still matter,
 * so this merges them rather than picking a winner — but everything that shows
 * a member their own shelf now asks one question instead of two, because
 * asking only one of them is exactly how an EPUB a student owns became
 * invisible in My Library while sitting in a second shelf they could not
 * navigate to.
 *
 * Where a title opens is decided here too. There are two readers — the chapter
 * reader for titles Kondo stores as text, and the EPUB reader for titles that
 * are a file — and every surface that linked to one of them was choosing by
 * its own rule. The catalogue sent every digital title to the chapter reader,
 * including EPUBs, which have no chapters and would have opened empty.
 */

export type LibraryItem = {
  id: string;
  slug: string;
  title: string;
  coverEmoji: string | null;
  imageUrl: string | null;
  format: "DIGITAL" | "PHYSICAL";
  deliveryType: StudyEssentialDelivery;
  chapterCount: number;
  acquiredAt: Date;
  /** Where tapping this goes. */
  href: string;
  /** Whether that destination is a reader rather than a product page. */
  readable: boolean;
  /** Reading progress, when the member has started it. */
  percentage: number;
  lastReadAt: Date | null;
};

type Openable = {
  slug: string;
  deliveryType: StudyEssentialDelivery;
  chapterCount: number;
};

/** Whether Kondo can actually open this title rather than describe it. */
export function isReadable(essential: Openable) {
  if (essential.deliveryType === "EPUB") return true;
  return essential.chapterCount > 0;
}

/**
 * The one place that decides where a title opens.
 *
 * An EPUB is a file and needs the EPUB reader; a text title is chapters in the
 * database and needs the chapter reader. Anything else is not readable and
 * belongs on its own product page.
 */
export function openHref(essential: Openable) {
  if (essential.deliveryType === "EPUB") {
    return `/student-hub/books/${essential.slug}`;
  }
  if (essential.chapterCount > 0) {
    return `/student-hub/essentials/read/${essential.slug}`;
  }
  return `/student-hub/essentials/${essential.slug}`;
}

/**
 * Everything a member owns, however they came to own it.
 *
 * Ordered first, then entitled, then de-duplicated: a title acquired both ways
 * is one book on one shelf, dated from whichever came first.
 */
export async function listOwnedLibrary(userId: string): Promise<LibraryItem[]> {
  const [ordered, entitled] = await Promise.all([
    listLibrary(userId),
    listEntitledEssentials(userId),
  ]);

  // Entitlements do not carry format or chapter counts, and the shelf needs
  // both to decide what a card says. One query for all of them rather than one
  // per title.
  const entitledIds = entitled.map((row) => row.id);
  const details = entitledIds.length
    ? await prisma.studyEssential.findMany({
        where: { id: { in: entitledIds } },
        select: {
          id: true,
          format: true,
          deliveryType: true,
          _count: { select: { chapters: true } },
        },
      })
    : [];
  const detailById = new Map(details.map((row) => [row.id, row]));

  const byId = new Map<string, LibraryItem>();

  const put = (item: LibraryItem) => {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      return;
    }
    // Keep the earliest acquisition date and whichever record knows about
    // reading progress.
    byId.set(item.id, {
      ...existing,
      acquiredAt:
        item.acquiredAt < existing.acquiredAt
          ? item.acquiredAt
          : existing.acquiredAt,
      percentage: Math.max(existing.percentage, item.percentage),
      lastReadAt: existing.lastReadAt ?? item.lastReadAt,
    });
  };

  for (const row of ordered) {
    const openable = {
      slug: row.essential.slug,
      deliveryType: row.essential.deliveryType,
      chapterCount: row.essential._count.chapters,
    };
    put({
      id: row.essential.id,
      slug: row.essential.slug,
      title: row.essential.title,
      coverEmoji: row.essential.coverEmoji,
      imageUrl: row.essential.imageUrl,
      format: row.essential.format,
      deliveryType: row.essential.deliveryType,
      chapterCount: row.essential._count.chapters,
      acquiredAt: row.placedAt,
      href: openHref(openable),
      readable: isReadable(openable),
      percentage: 0,
      lastReadAt: null,
    });
  }

  for (const row of entitled) {
    const detail = detailById.get(row.id);
    const openable = {
      slug: row.slug,
      deliveryType: detail?.deliveryType ?? row.deliveryType,
      chapterCount: detail?._count.chapters ?? 0,
    };
    put({
      id: row.id,
      slug: row.slug,
      title: row.title,
      coverEmoji: row.coverEmoji,
      imageUrl: row.imageUrl,
      format: detail?.format ?? "DIGITAL",
      deliveryType: openable.deliveryType,
      chapterCount: openable.chapterCount,
      acquiredAt: row.grantedAt ?? row.lastReadAt ?? new Date(),
      href: openHref(openable),
      readable: isReadable(openable),
      percentage: row.percentage,
      lastReadAt: row.lastReadAt,
    });
  }

  return [...byId.values()].sort(
    (first, second) => second.acquiredAt.getTime() - first.acquiredAt.getTime(),
  );
}

/**
 * Whether this member may open this title.
 *
 * Three things can make that true and the catalogue knew about one of them.
 * A paid order is the original route. An entitlement is the newer one. And a
 * free title needs neither — nothing is transacted, so there is no row to find
 * — which is why `checkEntitlement` is asked rather than reimplemented here:
 * it is the one place that already decides what "may open" means, and it is
 * the same function every reading surface calls.
 *
 * Asking only about orders showed "Buy this" over a book the member was
 * already reading, and for a free title it offered a checkout for nothing.
 */
export async function ownsEssential(userId: string, essentialId: string) {
  const [order, entitlement] = await Promise.all([
    prisma.studyEssentialOrder.findFirst({
      where: { userId, essentialId, status: "PAID" },
      select: { id: true },
    }),
    checkEntitlement({ userId, essentialId }),
  ]);
  return Boolean(order) || entitlement.allowed;
}
