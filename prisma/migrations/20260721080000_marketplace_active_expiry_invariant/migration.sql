UPDATE "MarketplaceListing"
SET
  "publishedAt" = COALESCE("publishedAt", "createdAt"),
  "expiresAt" = COALESCE("expiresAt", NOW() + INTERVAL '30 days')
WHERE
  "status" IN ('ACTIVE', 'RESERVED')
  AND ("publishedAt" IS NULL OR "expiresAt" IS NULL);

ALTER TABLE "MarketplaceListing"
ADD CONSTRAINT "MarketplaceListing_active_expiry_check"
CHECK (
  "status" NOT IN ('ACTIVE', 'RESERVED')
  OR ("publishedAt" IS NOT NULL AND "expiresAt" IS NOT NULL)
);
