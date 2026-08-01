DO $$ BEGIN
  CREATE TYPE "OrganizationProductStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'OUT_OF_STOCK', 'PAUSED', 'REJECTED', 'REMOVED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrganizationServiceStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'PAUSED', 'UNAVAILABLE', 'REJECTED', 'REMOVED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrganizationCatalogPriceType" AS ENUM ('FREE', 'FIXED', 'STARTING_AT', 'CONTACT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrganizationCatalogContactMethod" AS ENUM ('KONDO_MESSAGE', 'PUBLIC_CONTACT', 'EXTERNAL_URL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrganizationCatalogInquiryStatus" AS ENUM ('OPEN', 'RESPONDED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrganizationProductMediaKind" AS ENUM ('COVER', 'GALLERY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrganizationServiceMediaKind" AS ENUM ('COVER', 'GALLERY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "MediaPurpose" ADD VALUE IF NOT EXISTS 'ORGANIZATION_PRODUCT_IMAGE';
ALTER TYPE "MediaPurpose" ADD VALUE IF NOT EXISTS 'ORGANIZATION_SERVICE_IMAGE';

CREATE TABLE IF NOT EXISTS "OrganizationProduct" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "cityId" TEXT,
  "title" VARCHAR(180) NOT NULL,
  "shortDescription" VARCHAR(400) NOT NULL,
  "description" TEXT NOT NULL,
  "category" VARCHAR(100) NOT NULL,
  "status" "OrganizationProductStatus" NOT NULL DEFAULT 'DRAFT',
  "priceType" "OrganizationCatalogPriceType" NOT NULL DEFAULT 'CONTACT',
  "priceMinor" INTEGER,
  "currency" CHAR(3) NOT NULL DEFAULT 'CNY',
  "availabilityLabel" VARCHAR(180),
  "locationLabel" VARCHAR(200),
  "contactMethod" "OrganizationCatalogContactMethod" NOT NULL DEFAULT 'KONDO_MESSAGE',
  "externalUrl" VARCHAR(500),
  "publicationBlockedAt" TIMESTAMP(3),
  "externalUrlBlockedAt" TIMESTAMP(3),
  "moderationNote" VARCHAR(2000),
  "submittedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "outOfStockAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "searchVector" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("shortDescription", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("description", '')), 'C') ||
    setweight(to_tsvector('simple', coalesce("category", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("locationLabel", '')), 'C')
  ) STORED,
  CONSTRAINT "OrganizationProduct_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationProduct_price_check" CHECK (
    ("priceType" IN ('FIXED', 'STARTING_AT') AND "priceMinor" IS NOT NULL AND "priceMinor" >= 0)
    OR ("priceType" IN ('FREE', 'CONTACT') AND "priceMinor" IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS "OrganizationService" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "cityId" TEXT,
  "title" VARCHAR(180) NOT NULL,
  "shortDescription" VARCHAR(400) NOT NULL,
  "description" TEXT NOT NULL,
  "category" VARCHAR(100) NOT NULL,
  "status" "OrganizationServiceStatus" NOT NULL DEFAULT 'DRAFT',
  "priceType" "OrganizationCatalogPriceType" NOT NULL DEFAULT 'CONTACT',
  "priceMinor" INTEGER,
  "currency" CHAR(3) NOT NULL DEFAULT 'CNY',
  "availabilityLabel" VARCHAR(180),
  "deliveryMode" VARCHAR(160),
  "locationLabel" VARCHAR(200),
  "contactMethod" "OrganizationCatalogContactMethod" NOT NULL DEFAULT 'KONDO_MESSAGE',
  "externalUrl" VARCHAR(500),
  "publicationBlockedAt" TIMESTAMP(3),
  "externalUrlBlockedAt" TIMESTAMP(3),
  "moderationNote" VARCHAR(2000),
  "submittedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "unavailableAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "searchVector" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("shortDescription", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("description", '')), 'C') ||
    setweight(to_tsvector('simple', coalesce("category", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("deliveryMode", '')), 'C') ||
    setweight(to_tsvector('simple', coalesce("locationLabel", '')), 'C')
  ) STORED,
  CONSTRAINT "OrganizationService_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationService_price_check" CHECK (
    ("priceType" IN ('FIXED', 'STARTING_AT') AND "priceMinor" IS NOT NULL AND "priceMinor" >= 0)
    OR ("priceType" IN ('FREE', 'CONTACT') AND "priceMinor" IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS "OrganizationProductMedia" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "kind" "OrganizationProductMediaKind" NOT NULL DEFAULT 'GALLERY',
  "altText" VARCHAR(240) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationProductMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrganizationServiceMedia" (
  "id" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "kind" "OrganizationServiceMediaKind" NOT NULL DEFAULT 'GALLERY',
  "altText" VARCHAR(240) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationServiceMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrganizationProductSaved" (
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationProductSaved_pkey" PRIMARY KEY ("userId", "productId")
);

CREATE TABLE IF NOT EXISTS "OrganizationServiceSaved" (
  "userId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationServiceSaved_pkey" PRIMARY KEY ("userId", "serviceId")
);

CREATE TABLE IF NOT EXISTS "OrganizationProductInquiry" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "conversationId" TEXT,
  "status" "OrganizationCatalogInquiryStatus" NOT NULL DEFAULT 'OPEN',
  "topic" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationProductInquiry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrganizationServiceInquiry" (
  "id" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "conversationId" TEXT,
  "status" "OrganizationCatalogInquiryStatus" NOT NULL DEFAULT 'OPEN',
  "topic" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationServiceInquiry_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN ALTER TABLE "OrganizationProduct" ADD CONSTRAINT "OrganizationProduct_slug_key" UNIQUE ("slug"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationService" ADD CONSTRAINT "OrganizationService_slug_key" UNIQUE ("slug"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationProductMedia" ADD CONSTRAINT "OrganizationProductMedia_mediaId_key" UNIQUE ("mediaId"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationProductMedia" ADD CONSTRAINT "OrganizationProductMedia_productId_sortOrder_key" UNIQUE ("productId", "sortOrder"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationServiceMedia" ADD CONSTRAINT "OrganizationServiceMedia_mediaId_key" UNIQUE ("mediaId"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationServiceMedia" ADD CONSTRAINT "OrganizationServiceMedia_serviceId_sortOrder_key" UNIQUE ("serviceId", "sortOrder"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationProductInquiry" ADD CONSTRAINT "OrganizationProductInquiry_productId_requesterUserId_key" UNIQUE ("productId", "requesterUserId"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationServiceInquiry" ADD CONSTRAINT "OrganizationServiceInquiry_serviceId_requesterUserId_key" UNIQUE ("serviceId", "requesterUserId"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "OrganizationProduct" ADD CONSTRAINT "OrganizationProduct_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationProduct" ADD CONSTRAINT "OrganizationProduct_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationProduct" ADD CONSTRAINT "OrganizationProduct_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationService" ADD CONSTRAINT "OrganizationService_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationService" ADD CONSTRAINT "OrganizationService_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationService" ADD CONSTRAINT "OrganizationService_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationProductMedia" ADD CONSTRAINT "OrganizationProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "OrganizationProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationProductMedia" ADD CONSTRAINT "OrganizationProductMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationServiceMedia" ADD CONSTRAINT "OrganizationServiceMedia_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "OrganizationService"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationServiceMedia" ADD CONSTRAINT "OrganizationServiceMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationProductSaved" ADD CONSTRAINT "OrganizationProductSaved_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationProductSaved" ADD CONSTRAINT "OrganizationProductSaved_productId_fkey" FOREIGN KEY ("productId") REFERENCES "OrganizationProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationServiceSaved" ADD CONSTRAINT "OrganizationServiceSaved_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationServiceSaved" ADD CONSTRAINT "OrganizationServiceSaved_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "OrganizationService"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationProductInquiry" ADD CONSTRAINT "OrganizationProductInquiry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "OrganizationProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationProductInquiry" ADD CONSTRAINT "OrganizationProductInquiry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationProductInquiry" ADD CONSTRAINT "OrganizationProductInquiry_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationProductInquiry" ADD CONSTRAINT "OrganizationProductInquiry_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationProductInquiry" ADD CONSTRAINT "OrganizationProductInquiry_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationServiceInquiry" ADD CONSTRAINT "OrganizationServiceInquiry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "OrganizationService"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationServiceInquiry" ADD CONSTRAINT "OrganizationServiceInquiry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationServiceInquiry" ADD CONSTRAINT "OrganizationServiceInquiry_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationServiceInquiry" ADD CONSTRAINT "OrganizationServiceInquiry_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationServiceInquiry" ADD CONSTRAINT "OrganizationServiceInquiry_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "OrganizationProduct_organizationId_status_updatedAt_idx" ON "OrganizationProduct"("organizationId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "OrganizationProduct_cityId_status_publishedAt_idx" ON "OrganizationProduct"("cityId", "status", "publishedAt");
CREATE INDEX IF NOT EXISTS "OrganizationProduct_status_publishedAt_id_idx" ON "OrganizationProduct"("status", "publishedAt", "id");
CREATE INDEX IF NOT EXISTS "OrganizationProduct_category_status_idx" ON "OrganizationProduct"("category", "status");
CREATE INDEX IF NOT EXISTS "OrganizationProduct_searchVector_idx" ON "OrganizationProduct" USING GIN ("searchVector");
CREATE INDEX IF NOT EXISTS "OrganizationService_organizationId_status_updatedAt_idx" ON "OrganizationService"("organizationId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "OrganizationService_cityId_status_publishedAt_idx" ON "OrganizationService"("cityId", "status", "publishedAt");
CREATE INDEX IF NOT EXISTS "OrganizationService_status_publishedAt_id_idx" ON "OrganizationService"("status", "publishedAt", "id");
CREATE INDEX IF NOT EXISTS "OrganizationService_category_status_idx" ON "OrganizationService"("category", "status");
CREATE INDEX IF NOT EXISTS "OrganizationService_searchVector_idx" ON "OrganizationService" USING GIN ("searchVector");
CREATE INDEX IF NOT EXISTS "OrganizationProductMedia_productId_kind_sortOrder_idx" ON "OrganizationProductMedia"("productId", "kind", "sortOrder");
CREATE INDEX IF NOT EXISTS "OrganizationServiceMedia_serviceId_kind_sortOrder_idx" ON "OrganizationServiceMedia"("serviceId", "kind", "sortOrder");
CREATE INDEX IF NOT EXISTS "OrganizationProductSaved_userId_createdAt_idx" ON "OrganizationProductSaved"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrganizationProductSaved_productId_idx" ON "OrganizationProductSaved"("productId");
CREATE INDEX IF NOT EXISTS "OrganizationServiceSaved_userId_createdAt_idx" ON "OrganizationServiceSaved"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrganizationServiceSaved_serviceId_idx" ON "OrganizationServiceSaved"("serviceId");
CREATE INDEX IF NOT EXISTS "OrganizationProductInquiry_organizationId_status_createdAt_idx" ON "OrganizationProductInquiry"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "OrganizationProductInquiry_recipientUserId_status_createdAt_idx" ON "OrganizationProductInquiry"("recipientUserId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "OrganizationProductInquiry_conversationId_idx" ON "OrganizationProductInquiry"("conversationId");
CREATE INDEX IF NOT EXISTS "OrganizationServiceInquiry_organizationId_status_createdAt_idx" ON "OrganizationServiceInquiry"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "OrganizationServiceInquiry_recipientUserId_status_createdAt_idx" ON "OrganizationServiceInquiry"("recipientUserId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "OrganizationServiceInquiry_conversationId_idx" ON "OrganizationServiceInquiry"("conversationId");
