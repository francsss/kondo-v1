-- Marketplace conversations live in the existing messaging tables. All this
-- migration adds is the scope: a new conversation type, and a row that ties a
-- conversation to the listing two people are discussing.
--
-- Additive only. Nothing is dropped, no column changes type, and every
-- existing conversation keeps its DIRECT type and stays exactly where it is.

ALTER TYPE "ConversationType" ADD VALUE IF NOT EXISTS 'MARKETPLACE';

CREATE TABLE IF NOT EXISTS "MarketplaceInquiry" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceInquiry_pkey" PRIMARY KEY ("id")
);

-- One conversation per (listing, buyer): the database, not the application, is
-- what guarantees a second "Chat with seller" cannot open a duplicate thread.
CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceInquiry_conversationId_key"
    ON "MarketplaceInquiry"("conversationId");
CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceInquiry_listingId_buyerUserId_key"
    ON "MarketplaceInquiry"("listingId", "buyerUserId");
CREATE INDEX IF NOT EXISTS "MarketplaceInquiry_sellerUserId_createdAt_idx"
    ON "MarketplaceInquiry"("sellerUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketplaceInquiry_buyerUserId_createdAt_idx"
    ON "MarketplaceInquiry"("buyerUserId", "createdAt");

DO $$
BEGIN
    ALTER TABLE "MarketplaceInquiry"
        ADD CONSTRAINT "MarketplaceInquiry_listingId_fkey"
        FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "MarketplaceInquiry"
        ADD CONSTRAINT "MarketplaceInquiry_buyerUserId_fkey"
        FOREIGN KEY ("buyerUserId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "MarketplaceInquiry"
        ADD CONSTRAINT "MarketplaceInquiry_sellerUserId_fkey"
        FOREIGN KEY ("sellerUserId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "MarketplaceInquiry"
        ADD CONSTRAINT "MarketplaceInquiry_conversationId_fkey"
        FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
