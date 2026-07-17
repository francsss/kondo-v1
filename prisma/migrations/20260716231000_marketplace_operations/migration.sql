ALTER TABLE "MarketplaceCategory"
ADD COLUMN "description" VARCHAR(300),
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "MarketplaceListing"
ADD COLUMN "reservedAt" TIMESTAMP(3),
ADD COLUMN "soldAt" TIMESTAMP(3),
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "removedAt" TIMESTAMP(3),
ADD COLUMN "moderatedAt" TIMESTAMP(3),
ADD COLUMN "fraudScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "fraudFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "fraudReviewedAt" TIMESTAMP(3);

UPDATE "MarketplaceListing"
SET "expiresAt" = COALESCE(
  "expiresAt",
  COALESCE("publishedAt", "createdAt") + INTERVAL '30 days'
)
WHERE "status" IN ('ACTIVE', 'RESERVED');

ALTER TABLE "MarketplaceListing"
ADD CONSTRAINT "MarketplaceListing_price_check"
CHECK ("priceFen" >= 0),
ADD CONSTRAINT "MarketplaceListing_fraud_score_check"
CHECK ("fraudScore" >= 0 AND "fraudScore" <= 100);

ALTER TABLE "ListingImage"
ALTER COLUMN "objectKey" DROP NOT NULL,
ADD COLUMN "mediaId" TEXT;

CREATE INDEX "MarketplaceCategory_isActive_order_idx"
ON "MarketplaceCategory"("isActive", "order");

CREATE INDEX "MarketplaceListing_status_expiresAt_idx"
ON "MarketplaceListing"("status", "expiresAt");

CREATE INDEX "MarketplaceListing_fraudScore_status_updatedAt_idx"
ON "MarketplaceListing"("fraudScore", "status", "updatedAt");

CREATE UNIQUE INDEX "ListingImage_mediaId_key"
ON "ListingImage"("mediaId");

CREATE UNIQUE INDEX "ListingImage_listingId_order_key"
ON "ListingImage"("listingId", "order");

CREATE UNIQUE INDEX "Report_active_marketplace_listing_key"
ON "Report"("reporterId", "targetType", "targetId")
WHERE
  "reporterId" IS NOT NULL
  AND "targetType" = 'MarketplaceListing'
  AND "status" IN ('OPEN', 'REVIEWING');

ALTER TABLE "ListingImage"
ADD CONSTRAINT "ListingImage_mediaId_fkey"
FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
