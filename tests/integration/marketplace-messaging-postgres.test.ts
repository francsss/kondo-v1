import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getMarketplaceInbox,
  getMarketplaceThreadContext,
  openMarketplaceConversation,
} from "@/lib/marketplace-messaging";
import {
  createDirectMessage,
  getInbox,
  getUnreadMessageCount,
  replyToConversation,
} from "@/lib/messaging";
import { prisma } from "@/lib/prisma";

/**
 * Marketplace conversations are scoped, not separate.
 *
 * The same tables, the same messages and the same read accounting serve both
 * inboxes; what changed is that a listing conversation carries the listing and
 * is listed under Marketplace. These assert the two halves that matter: that a
 * buyer's enquiry never turns up in their ordinary Messages, and that asking
 * twice about the same listing continues the thread that already exists rather
 * than starting a second one.
 */

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "marketplace-messaging.test";

type Fixture = Awaited<ReturnType<typeof createFixture>>;
let fixture: Fixture;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  if (userIds.length === 0) return;
  await prisma.notificationJob.deleteMany({
    where: {
      OR: [{ recipientId: { in: userIds } }, { actorId: { in: userIds } }],
    },
  });
  await prisma.notification.deleteMany({
    where: { recipientId: { in: userIds } },
  });
  await prisma.marketplaceInquiry.deleteMany({
    where: {
      OR: [{ buyerUserId: { in: userIds } }, { sellerUserId: { in: userIds } }],
    },
  });
  await prisma.marketplaceListing.deleteMany({
    where: { sellerId: { in: userIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.marketplaceCategory.deleteMany({
    where: { slug: { startsWith: "mm-category-" } },
  });
  await prisma.city.deleteMany({ where: { slug: { startsWith: "mm-city-" } } });
  await prisma.country.deleteMany({ where: { code: "Q7" } });
}

async function createFixture() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const [buyer, seller, otherBuyer] = await Promise.all([
    prisma.user.create({
      data: {
        email: `buyer-${suffix}@${testDomain}`,
        firstName: "Bina",
        lastName: "Buyer",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        email: `seller-${suffix}@${testDomain}`,
        firstName: "Sena",
        lastName: "Seller",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        email: `other-${suffix}@${testDomain}`,
        firstName: "Omar",
        lastName: "Other",
        status: "ACTIVE",
      },
    }),
  ]);
  // A code outside the ISO list, so this cannot collide with a seeded country.
  const country = await prisma.country.upsert({
    where: { code: "Q7" },
    create: { code: "Q7", name: "MM Country Fixture", isActive: true },
    update: {},
  });
  const city = await prisma.city.create({
    data: {
      slug: `mm-city-${suffix}`,
      name: `MM City ${suffix}`,
      countryId: country.id,
      isActive: true,
    },
  });
  const category = await prisma.marketplaceCategory.create({
    data: { slug: `mm-category-${suffix}`, name: `MM Category ${suffix}` },
  });
  const listing = await prisma.marketplaceListing.create({
    data: {
      slug: `mm-listing-${suffix}`,
      sellerId: seller.id,
      categoryId: category.id,
      cityId: city.id,
      title: "Desk lamp, barely used",
      description: "A listing used to exercise marketplace conversations.",
      priceFen: 4500,
      status: "ACTIVE",
      publishedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 86_400_000),
    },
  });
  const secondListing = await prisma.marketplaceListing.create({
    data: {
      slug: `mm-listing-2-${suffix}`,
      sellerId: seller.id,
      categoryId: category.id,
      cityId: city.id,
      title: "Rice cooker",
      description: "A second listing from the same seller.",
      priceFen: 12000,
      status: "ACTIVE",
      publishedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 86_400_000),
    },
  });
  return { buyer, seller, otherBuyer, listing, secondListing };
}

postgresDescribe(
  "marketplace conversations are scoped to their listing",
  () => {
    beforeAll(async () => {
      await cleanup();
      fixture = await createFixture();
    });

    afterAll(cleanup);

    it("opens one conversation per buyer and listing, however many times it is asked", async () => {
      const first = await openMarketplaceConversation({
        listingId: fixture.listing.id,
        buyerId: fixture.buyer.id,
      });
      const second = await openMarketplaceConversation({
        listingId: fixture.listing.id,
        buyerId: fixture.buyer.id,
      });
      expect(first.new).toBe(true);
      expect(second.new).toBe(false);
      expect(second.conversationId).toBe(first.conversationId);
      expect(
        await prisma.marketplaceInquiry.count({
          where: {
            listingId: fixture.listing.id,
            buyerUserId: fixture.buyer.id,
          },
        }),
      ).toBe(1);
    });

    it("keeps a second listing from the same pair in its own thread", async () => {
      const lamp = await openMarketplaceConversation({
        listingId: fixture.listing.id,
        buyerId: fixture.buyer.id,
      });
      const cooker = await openMarketplaceConversation({
        listingId: fixture.secondListing.id,
        buyerId: fixture.buyer.id,
      });
      expect(cooker.conversationId).not.toBe(lamp.conversationId);
    });

    it("never puts a listing conversation in the ordinary Messages inbox", async () => {
      const opened = await openMarketplaceConversation({
        listingId: fixture.listing.id,
        buyerId: fixture.buyer.id,
      });
      await replyToConversation({
        conversationId: opened.conversationId,
        senderId: fixture.buyer.id,
        body: "Is the lamp still available?",
      });

      const buyerMessages = await getInbox(fixture.buyer.id);
      const sellerMessages = await getInbox(fixture.seller.id);
      for (const inbox of [buyerMessages, sellerMessages]) {
        expect(
          inbox.conversations.map(({ conversationId }) => conversationId),
        ).not.toContain(opened.conversationId);
      }

      const sellerMarketplace = await getMarketplaceInbox(fixture.seller.id);
      const thread = sellerMarketplace.conversations.find(
        (item) => item.conversationId === opened.conversationId,
      );
      expect(thread).toBeDefined();
      expect(thread?.listing.title).toBe("Desk lamp, barely used");
      expect(thread?.viewerIsSeller).toBe(true);
      expect(thread?.unreadCount).toBeGreaterThan(0);
    });

    it("keeps the two unread badges apart", async () => {
      // The seller has an unread marketplace message from the test above and no
      // ordinary conversation at all; the Messages badge must not borrow it.
      expect(await getUnreadMessageCount(fixture.seller.id, "DIRECT")).toBe(0);
      expect(
        await getUnreadMessageCount(fixture.seller.id, "MARKETPLACE"),
      ).toBeGreaterThan(0);

      // And an ordinary conversation stays out of the marketplace count.
      await createDirectMessage({
        senderId: fixture.otherBuyer.id,
        recipientId: fixture.seller.id,
        body: "Unrelated hello, nothing to do with a listing.",
      });
      expect(
        await getUnreadMessageCount(fixture.seller.id, "DIRECT"),
      ).toBeGreaterThan(0);
      const marketplaceInbox = await getMarketplaceInbox(fixture.seller.id);
      expect(
        marketplaceInbox.conversations.every((item) => Boolean(item.listing)),
      ).toBe(true);
    });

    it("shows the thread its listing context, and only to its participants", async () => {
      const opened = await openMarketplaceConversation({
        listingId: fixture.listing.id,
        buyerId: fixture.buyer.id,
      });
      const buyerView = await getMarketplaceThreadContext(
        opened.conversationId,
        fixture.buyer.id,
      );
      expect(buyerView?.listing.title).toBe("Desk lamp, barely used");
      expect(buyerView?.viewerIsSeller).toBe(false);
      expect(
        await getMarketplaceThreadContext(
          opened.conversationId,
          fixture.otherBuyer.id,
        ),
      ).toBeNull();
    });

    it("refuses a seller messaging themselves", async () => {
      await expect(
        openMarketplaceConversation({
          listingId: fixture.listing.id,
          buyerId: fixture.seller.id,
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("refuses a new enquiry on an archived listing but keeps the history", async () => {
      const opened = await openMarketplaceConversation({
        listingId: fixture.secondListing.id,
        buyerId: fixture.buyer.id,
      });
      await replyToConversation({
        conversationId: opened.conversationId,
        senderId: fixture.buyer.id,
        body: "Does the rice cooker come with the measuring cup?",
      });
      await prisma.marketplaceListing.update({
        where: { id: fixture.secondListing.id },
        data: { status: "SOLD", soldAt: new Date(), archivedAt: new Date() },
      });

      // Someone who never asked can no longer start.
      await expect(
        openMarketplaceConversation({
          listingId: fixture.secondListing.id,
          buyerId: fixture.otherBuyer.id,
        }),
      ).rejects.toMatchObject({ status: 409 });

      // The buyer who did keeps their thread, and can still write in it — this
      // is exactly when handover gets arranged.
      const reopened = await openMarketplaceConversation({
        listingId: fixture.secondListing.id,
        buyerId: fixture.buyer.id,
      });
      expect(reopened.conversationId).toBe(opened.conversationId);
      const inbox = await getMarketplaceInbox(fixture.buyer.id);
      const sold = inbox.conversations.find(
        (item) => item.conversationId === opened.conversationId,
      );
      expect(sold?.listing.soldAt).not.toBeNull();
      await expect(
        replyToConversation({
          conversationId: opened.conversationId,
          senderId: fixture.buyer.id,
          body: "Great — when can I collect it?",
        }),
      ).resolves.toMatchObject({ conversationId: opened.conversationId });
    });

    it("refuses when either side has blocked the other", async () => {
      const block = await prisma.userBlock.create({
        data: {
          blockerId: fixture.seller.id,
          blockedId: fixture.otherBuyer.id,
        },
      });
      try {
        await expect(
          openMarketplaceConversation({
            listingId: fixture.listing.id,
            buyerId: fixture.otherBuyer.id,
          }),
        ).rejects.toMatchObject({ status: 403 });
      } finally {
        await prisma.userBlock.delete({
          where: {
            blockerId_blockedId: {
              blockerId: block.blockerId,
              blockedId: block.blockedId,
            },
          },
        });
      }
    });

    it("leaves an opened-but-unused thread out of the seller's inbox", async () => {
      const opened = await openMarketplaceConversation({
        listingId: fixture.listing.id,
        buyerId: fixture.otherBuyer.id,
      });
      const inbox = await getMarketplaceInbox(fixture.seller.id);
      expect(
        inbox.conversations.map(({ conversationId }) => conversationId),
      ).not.toContain(opened.conversationId);
    });
  },
);
