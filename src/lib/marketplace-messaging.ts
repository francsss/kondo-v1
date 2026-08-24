import { Prisma } from "@prisma/client";
import { isBlockedBetween, MessagingError } from "@/lib/messaging";
import { prisma } from "@/lib/prisma";

/**
 * Marketplace conversations.
 *
 * A buyer asking about a listing and a friend asking how your week is going
 * used to be the same thread: Kondo keys a direct conversation on the pair of
 * people, so every marketplace enquiry a member ever sent landed in their
 * ordinary Messages, mixed in with everything else and carrying no trace of
 * what was being bought. Sellers had it worse — a dozen buyers, a dozen
 * threads, no listing attached to any of them.
 *
 * Nothing here is a second messaging system. The conversation is an ordinary
 * `Conversation`, the messages are ordinary `Message` rows, the composer, the
 * attachment handling, the block checks, the read receipts and the
 * notifications are all the ones Messages already uses. What this module adds
 * is scope: a `MarketplaceInquiry` row naming the listing, a conversation type
 * that keeps these threads out of the Messages inbox, and the two projections
 * that read them back.
 */

const listingContextSelect = {
  id: true,
  slug: true,
  title: true,
  priceFen: true,
  isNegotiable: true,
  status: true,
  soldAt: true,
  archivedAt: true,
  sellerId: true,
  city: { select: { name: true } },
  category: { select: { name: true, icon: true } },
  images: {
    orderBy: { order: "asc" as const },
    take: 1,
    select: { mediaId: true, altText: true },
  },
} satisfies Prisma.MarketplaceListingSelect;

const participantSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  avatarKey: true,
  avatarMediaId: true,
} satisfies Prisma.UserSelect;

export type MarketplaceThreadListing = Prisma.MarketplaceListingGetPayload<{
  select: typeof listingContextSelect;
}>;

/**
 * Whether a listing can still take a *new* enquiry.
 *
 * Deliberately narrower than what can be *read*: an existing thread about a
 * sold listing stays open, because the sale is exactly when buyer and seller
 * most need to arrange handover. Only starting from scratch is refused.
 */
function listingAcceptsNewInquiries(listing: {
  status: string;
  archivedAt: Date | null;
}) {
  return (
    !listing.archivedAt &&
    (listing.status === "ACTIVE" || listing.status === "RESERVED")
  );
}

/**
 * Find, or create, the one conversation this buyer has about this listing.
 *
 * The unique index on `(listingId, buyerUserId)` is what makes this safe under
 * a double tap or two tabs: the second insert loses, and the loser reads the
 * winner's row rather than opening a second thread.
 */
export async function openMarketplaceConversation(input: {
  listingId: string;
  buyerId: string;
}) {
  const listing = await prisma.marketplaceListing.findUnique({
    where: { id: input.listingId },
    select: {
      id: true,
      sellerId: true,
      status: true,
      archivedAt: true,
      removedAt: true,
      seller: { select: { id: true, status: true } },
    },
  });
  if (!listing || listing.removedAt) {
    throw new MessagingError("This listing is no longer available.", 404);
  }
  if (listing.sellerId === input.buyerId) {
    throw new MessagingError("This is your own listing.", 400);
  }
  if (listing.seller.status !== "ACTIVE") {
    throw new MessagingError("This seller is not available.", 404);
  }
  if (await isBlockedBetween(input.buyerId, listing.sellerId)) {
    throw new MessagingError(
      "Messaging is unavailable for this conversation.",
      403,
    );
  }

  const existing = await prisma.marketplaceInquiry.findUnique({
    where: {
      listingId_buyerUserId: {
        listingId: listing.id,
        buyerUserId: input.buyerId,
      },
    },
    select: { conversationId: true },
  });
  if (existing) return { conversationId: existing.conversationId, new: false };

  if (!listingAcceptsNewInquiries(listing)) {
    throw new MessagingError("This listing is no longer available.", 409);
  }

  try {
    const inquiry = await prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          type: "MARKETPLACE",
          // `directKey` is the uniqueness rule for person-to-person threads and
          // must stay null here, or a marketplace thread would collide with the
          // same two people's ordinary conversation.
          participants: {
            create: [
              { userId: input.buyerId },
              { userId: listing.sellerId },
            ],
          },
        },
        select: { id: true },
      });
      return tx.marketplaceInquiry.create({
        data: {
          listingId: listing.id,
          buyerUserId: input.buyerId,
          sellerUserId: listing.sellerId,
          conversationId: conversation.id,
        },
        select: { conversationId: true },
      });
    });
    return { conversationId: inquiry.conversationId, new: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Lost the race. The winner's thread is the one thread that should exist.
      const raced = await prisma.marketplaceInquiry.findUnique({
        where: {
          listingId_buyerUserId: {
            listingId: listing.id,
            buyerUserId: input.buyerId,
          },
        },
        select: { conversationId: true },
      });
      if (raced) return { conversationId: raced.conversationId, new: false };
    }
    throw error;
  }
}

/**
 * The listing context a thread is about, for the member viewing it.
 *
 * Returns null when the conversation is not a marketplace thread this member
 * belongs to, which is all the authorisation this needs: participation in the
 * conversation is the permission.
 */
export async function getMarketplaceThreadContext(
  conversationId: string,
  userId: string,
) {
  const inquiry = await prisma.marketplaceInquiry.findUnique({
    where: { conversationId },
    select: {
      buyerUserId: true,
      sellerUserId: true,
      listing: { select: listingContextSelect },
      conversation: {
        select: { participants: { select: { userId: true } } },
      },
    },
  });
  if (!inquiry) return null;
  if (
    !inquiry.conversation.participants.some(
      (participant) => participant.userId === userId,
    )
  ) {
    return null;
  }
  return {
    listing: inquiry.listing,
    viewerIsSeller: inquiry.sellerUserId === userId,
    buyerUserId: inquiry.buyerUserId,
    sellerUserId: inquiry.sellerUserId,
  };
}

const MARKETPLACE_INBOX_PAGE_SIZE = 20;

/**
 * The Marketplace inbox: this member's listing conversations, both the ones
 * they started as a buyer and the ones buyers started with them.
 *
 * A conversation with no message yet is left out. One is created the moment
 * someone opens the thread, and a seller should not see an enquiry that was
 * never actually sent.
 */
export async function getMarketplaceInbox(
  userId: string,
  input: { page?: number; role?: "all" | "buying" | "selling" } = {},
) {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const role = input.role ?? "all";
  const where: Prisma.ConversationParticipantWhereInput = {
    userId,
    deletedAt: null,
    // Archiving is a Messages-inbox idea and there is no archived folder here,
    // so an archived thread stays listed rather than disappearing with no way
    // back to the listing it belongs to.
    conversation: {
      type: "MARKETPLACE",
      messages: { some: {} },
      marketplaceInquiry:
        role === "buying"
          ? { buyerUserId: userId }
          : role === "selling"
            ? { sellerUserId: userId }
            : {},
    },
  };

  const [total, memberships] = await Promise.all([
    prisma.conversationParticipant.count({ where }),
    prisma.conversationParticipant.findMany({
      where,
      select: {
        conversationId: true,
        conversation: {
          select: {
            participants: { select: { user: { select: participantSelect } } },
            messages: {
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 1,
              select: {
                id: true,
                senderId: true,
                body: true,
                attachmentName: true,
                type: true,
                createdAt: true,
              },
            },
            marketplaceInquiry: {
              select: {
                sellerUserId: true,
                listing: { select: listingContextSelect },
              },
            },
          },
        },
      },
      orderBy: [
        { conversation: { lastMessageAt: "desc" } },
        { conversationId: "desc" },
      ],
      skip: (page - 1) * MARKETPLACE_INBOX_PAGE_SIZE,
      take: MARKETPLACE_INBOX_PAGE_SIZE,
    }),
  ]);

  const conversationIds = memberships.map((row) => row.conversationId);
  const unreadRows =
    conversationIds.length === 0
      ? []
      : await prisma.$queryRaw<Array<{ conversationId: string; count: bigint }>>(
          Prisma.sql`
            SELECT
              cp."conversationId" AS "conversationId",
              COUNT(m."id")::bigint AS "count"
            FROM "ConversationParticipant" cp
            JOIN "Message" m ON m."conversationId" = cp."conversationId"
            WHERE cp."userId" = ${userId}
              AND cp."conversationId" IN (${Prisma.join(conversationIds)})
              AND m."senderId" <> ${userId}
              AND (cp."lastReadAt" IS NULL OR m."createdAt" > cp."lastReadAt")
              AND (cp."clearedAt" IS NULL OR m."createdAt" > cp."clearedAt")
            GROUP BY cp."conversationId"
          `,
        );
  const unreadByConversation = new Map(
    unreadRows.map((row) => [row.conversationId, Number(row.count)]),
  );

  return {
    conversations: memberships.flatMap((membership) => {
      const inquiry = membership.conversation.marketplaceInquiry;
      const latestMessage = membership.conversation.messages[0];
      const other = membership.conversation.participants.find(
        (participant) => participant.user.id !== userId,
      )?.user;
      if (!inquiry || !latestMessage || !other) return [];
      return [
        {
          conversationId: membership.conversationId,
          listing: inquiry.listing,
          viewerIsSeller: inquiry.sellerUserId === userId,
          otherParticipant: other,
          unreadCount: unreadByConversation.get(membership.conversationId) ?? 0,
          latestMessage: {
            id: latestMessage.id,
            senderId: latestMessage.senderId,
            preview:
              latestMessage.body ??
              latestMessage.attachmentName ??
              (latestMessage.type === "IMAGE" ? "Photo" : "Attachment"),
            createdAt: latestMessage.createdAt,
          },
        },
      ];
    }),
    page,
    pageCount: Math.max(1, Math.ceil(total / MARKETPLACE_INBOX_PAGE_SIZE)),
    total,
    role,
  };
}
