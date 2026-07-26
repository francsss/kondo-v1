CREATE TYPE "PeerOfferStatus" AS ENUM ('ACTIVE', 'CLOSED', 'REMOVED');

CREATE TABLE "CommunityExchangeOffer" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "cityId" TEXT,
  "haveCurrency" VARCHAR(12) NOT NULL,
  "needCurrency" VARCHAR(12) NOT NULL,
  "haveAmount" VARCHAR(40),
  "needAmount" VARCHAR(40),
  "note" VARCHAR(500),
  "status" "PeerOfferStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunityExchangeOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentSkillOffer" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "cityId" TEXT,
  "title" VARCHAR(120) NOT NULL,
  "category" VARCHAR(60) NOT NULL,
  "description" VARCHAR(700) NOT NULL,
  "availability" VARCHAR(160),
  "status" "PeerOfferStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentSkillOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunityExchangeOffer_status_expiresAt_createdAt_idx"
  ON "CommunityExchangeOffer"("status", "expiresAt", "createdAt");
CREATE INDEX "CommunityExchangeOffer_ownerId_status_idx"
  ON "CommunityExchangeOffer"("ownerId", "status");
CREATE INDEX "CommunityExchangeOffer_cityId_status_idx"
  ON "CommunityExchangeOffer"("cityId", "status");
CREATE INDEX "StudentSkillOffer_status_expiresAt_createdAt_idx"
  ON "StudentSkillOffer"("status", "expiresAt", "createdAt");
CREATE INDEX "StudentSkillOffer_ownerId_status_idx"
  ON "StudentSkillOffer"("ownerId", "status");
CREATE INDEX "StudentSkillOffer_cityId_status_idx"
  ON "StudentSkillOffer"("cityId", "status");

ALTER TABLE "CommunityExchangeOffer"
  ADD CONSTRAINT "CommunityExchangeOffer_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityExchangeOffer"
  ADD CONSTRAINT "CommunityExchangeOffer_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentSkillOffer"
  ADD CONSTRAINT "StudentSkillOffer_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentSkillOffer"
  ADD CONSTRAINT "StudentSkillOffer_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
