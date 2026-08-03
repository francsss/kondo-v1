DO $$ BEGIN
  CREATE TYPE "StudyEssentialFormat" AS ENUM ('DIGITAL', 'PHYSICAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StudyEssentialSource" AS ENUM ('KONDO', 'PARTNER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StudyEssentialStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StudyEssentialOrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StudyEssentialPaymentProvider" AS ENUM ('SIMULATED', 'ALIPAY', 'WECHAT_PAY', 'CARD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "StudyEssential" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "shortDescription" VARCHAR(400) NOT NULL,
  "description" TEXT NOT NULL,
  "category" VARCHAR(100) NOT NULL,
  "format" "StudyEssentialFormat" NOT NULL,
  "source" "StudyEssentialSource" NOT NULL DEFAULT 'KONDO',
  "status" "StudyEssentialStatus" NOT NULL DEFAULT 'DRAFT',
  "priceMinor" INTEGER,
  "currency" CHAR(3) NOT NULL DEFAULT 'CNY',
  "providerName" VARCHAR(160),
  "externalUrl" VARCHAR(500),
  "imageUrl" VARCHAR(500),
  "coverEmoji" VARCHAR(16),
  "highlights" TEXT[],
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudyEssential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudyEssential_slug_key" ON "StudyEssential"("slug");
CREATE INDEX IF NOT EXISTS "StudyEssential_status_sortOrder_idx" ON "StudyEssential"("status", "sortOrder");
CREATE INDEX IF NOT EXISTS "StudyEssential_status_format_idx" ON "StudyEssential"("status", "format");
CREATE INDEX IF NOT EXISTS "StudyEssential_status_source_idx" ON "StudyEssential"("status", "source");

CREATE TABLE IF NOT EXISTS "StudyEssentialOrder" (
  "id" TEXT NOT NULL,
  "reference" VARCHAR(32) NOT NULL,
  "userId" TEXT NOT NULL,
  "essentialId" TEXT NOT NULL,
  "titleSnapshot" VARCHAR(180) NOT NULL,
  "formatSnapshot" "StudyEssentialFormat" NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPriceMinor" INTEGER NOT NULL,
  "totalMinor" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "status" "StudyEssentialOrderStatus" NOT NULL DEFAULT 'PENDING',
  "paymentProvider" "StudyEssentialPaymentProvider" NOT NULL DEFAULT 'SIMULATED',
  "paymentReference" VARCHAR(120),
  "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  CONSTRAINT "StudyEssentialOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudyEssentialOrder_reference_key" ON "StudyEssentialOrder"("reference");
CREATE INDEX IF NOT EXISTS "StudyEssentialOrder_userId_placedAt_idx" ON "StudyEssentialOrder"("userId", "placedAt");
CREATE INDEX IF NOT EXISTS "StudyEssentialOrder_essentialId_status_idx" ON "StudyEssentialOrder"("essentialId", "status");

DO $$ BEGIN
  ALTER TABLE "StudyEssentialOrder"
    ADD CONSTRAINT "StudyEssentialOrder_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StudyEssentialOrder"
    ADD CONSTRAINT "StudyEssentialOrder_essentialId_fkey"
    FOREIGN KEY ("essentialId") REFERENCES "StudyEssential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
