-- Books: delivery, rights, entitlements, reading locators and bookmarks.
--
-- Additive throughout. Every column is nullable or carries a default, every
-- table is new, and nothing existing is dropped or rewritten — the catalogue
-- that is live today keeps working unchanged, as a TEXT-delivery title with no
-- rights granted.
--
-- The defaults are deliberately the conservative answer. A title that existed
-- before this migration gets deliveryType = TEXT (which is what it is) and all
-- four rights flags false, so no pre-existing row silently starts permitting
-- AI processing, copying, download or print.

-- --------------------------------------------------------------------------
-- Enums
-- --------------------------------------------------------------------------

ALTER TYPE "StudyEssentialOrderStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

DO $$ BEGIN
  CREATE TYPE "StudyEssentialDelivery" AS ENUM ('TEXT', 'EPUB', 'PDF', 'EXTERNAL', 'DRM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StudyEntitlementSource" AS ENUM ('PURCHASE', 'PILOT', 'GRANT', 'PARTNER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StudyEntitlementStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --------------------------------------------------------------------------
-- StudyEssential: book metadata, delivery, rights
-- --------------------------------------------------------------------------

ALTER TABLE "StudyEssential"
  ADD COLUMN IF NOT EXISTS "author" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "subtitle" VARCHAR(300),
  ADD COLUMN IF NOT EXISTS "publisher" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "isbn" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "language" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "deliveryType" "StudyEssentialDelivery" NOT NULL DEFAULT 'TEXT',
  ADD COLUMN IF NOT EXISTS "assetKey" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "assetContentType" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "assetBytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "aiAllowed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "copyAllowed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "downloadAllowed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "printAllowed" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "StudyEssential_status_deliveryType_idx"
  ON "StudyEssential" ("status", "deliveryType");

-- --------------------------------------------------------------------------
-- StudyEssentialOrder: provider reconciliation
-- --------------------------------------------------------------------------

ALTER TABLE "StudyEssentialOrder"
  ADD COLUMN IF NOT EXISTS "providerPayload" JSONB;

-- Unique so a replayed provider notification cannot be attached to a second
-- order. Partial, because most existing rows have no payment reference yet and
-- NULLs must stay repeatable.
CREATE UNIQUE INDEX IF NOT EXISTS "StudyEssentialOrder_paymentReference_key"
  ON "StudyEssentialOrder" ("paymentReference")
  WHERE "paymentReference" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "StudyEssentialOrder_status_placedAt_idx"
  ON "StudyEssentialOrder" ("status", "placedAt");

-- --------------------------------------------------------------------------
-- StudyEntitlement
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "StudyEntitlement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "essentialId" TEXT NOT NULL,
  "source" "StudyEntitlementSource" NOT NULL DEFAULT 'PURCHASE',
  "status" "StudyEntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
  "orderId" TEXT,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StudyEntitlement_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StudyEntitlement"
  DROP CONSTRAINT IF EXISTS "StudyEntitlement_userId_fkey";
ALTER TABLE "StudyEntitlement"
  ADD CONSTRAINT "StudyEntitlement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "StudyEntitlement"
  DROP CONSTRAINT IF EXISTS "StudyEntitlement_essentialId_fkey";
ALTER TABLE "StudyEntitlement"
  ADD CONSTRAINT "StudyEntitlement_essentialId_fkey"
    FOREIGN KEY ("essentialId") REFERENCES "StudyEssential"("id") ON DELETE CASCADE;

-- SET NULL rather than CASCADE: losing the order should not silently withdraw
-- a book someone paid for.
ALTER TABLE "StudyEntitlement"
  DROP CONSTRAINT IF EXISTS "StudyEntitlement_orderId_fkey";
ALTER TABLE "StudyEntitlement"
  ADD CONSTRAINT "StudyEntitlement_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "StudyEssentialOrder"("id") ON DELETE SET NULL;

-- The idempotency guarantee: one grant per member per title, so a duplicate
-- payment notification has only one row to write.
CREATE UNIQUE INDEX IF NOT EXISTS "StudyEntitlement_userId_essentialId_key"
  ON "StudyEntitlement" ("userId", "essentialId");
CREATE UNIQUE INDEX IF NOT EXISTS "StudyEntitlement_orderId_key"
  ON "StudyEntitlement" ("orderId");
CREATE INDEX IF NOT EXISTS "StudyEntitlement_userId_status_idx"
  ON "StudyEntitlement" ("userId", "status");
CREATE INDEX IF NOT EXISTS "StudyEntitlement_essentialId_status_idx"
  ON "StudyEntitlement" ("essentialId", "status");

-- --------------------------------------------------------------------------
-- Reading position and annotations
-- --------------------------------------------------------------------------

ALTER TABLE "StudyReadingProgress"
  ADD COLUMN IF NOT EXISTS "locator" VARCHAR(600),
  ADD COLUMN IF NOT EXISTS "percentage" INTEGER;

ALTER TABLE "StudyNote"
  ADD COLUMN IF NOT EXISTS "locator" VARCHAR(600),
  ADD COLUMN IF NOT EXISTS "color" VARCHAR(20);

CREATE TABLE IF NOT EXISTS "StudyBookmark" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "essentialId" TEXT NOT NULL,
  "locator" VARCHAR(600) NOT NULL,
  "label" VARCHAR(300),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StudyBookmark_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StudyBookmark"
  DROP CONSTRAINT IF EXISTS "StudyBookmark_userId_fkey";
ALTER TABLE "StudyBookmark"
  ADD CONSTRAINT "StudyBookmark_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "StudyBookmark"
  DROP CONSTRAINT IF EXISTS "StudyBookmark_essentialId_fkey";
ALTER TABLE "StudyBookmark"
  ADD CONSTRAINT "StudyBookmark_essentialId_fkey"
    FOREIGN KEY ("essentialId") REFERENCES "StudyEssential"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "StudyBookmark_userId_essentialId_locator_key"
  ON "StudyBookmark" ("userId", "essentialId", "locator");
CREATE INDEX IF NOT EXISTS "StudyBookmark_userId_essentialId_createdAt_idx"
  ON "StudyBookmark" ("userId", "essentialId", "createdAt");
