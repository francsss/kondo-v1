CREATE TYPE "ScholarshipStatus" AS ENUM ('OPEN', 'OPENING_SOON', 'CLOSED');
CREATE TYPE "ScholarshipAgentAvailability" AS ENUM ('AVAILABLE', 'LIMITED', 'UNAVAILABLE');
ALTER TYPE "ReportEvidenceKind" ADD VALUE 'SCHOLARSHIP_AGENT_SNAPSHOT';

ALTER TABLE "Scholarship"
ADD COLUMN "slug" TEXT,
ADD COLUMN "countryId" TEXT,
ADD COLUMN "status" "ScholarshipStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN "opensAt" DATE,
ADD COLUMN "closesAt" DATE,
ADD COLUMN "eligibilityCriteria" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "requiredDocuments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "coverage" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "applicationSteps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lastVerifiedAt" TIMESTAMP(3);

UPDATE "Scholarship"
SET
  "slug" = 'scholarship-' || "id",
  "closesAt" = "deadline";

UPDATE "Scholarship" AS scholarship
SET "countryId" = university."countryId"
FROM "University" AS university
WHERE scholarship."universityId" = university."id";

UPDATE "Scholarship"
SET "status" = 'CLOSED'
WHERE "closesAt" IS NOT NULL AND "closesAt" < CURRENT_DATE;

ALTER TABLE "Scholarship" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Scholarship_slug_key" ON "Scholarship"("slug");
CREATE INDEX "Scholarship_isActive_status_closesAt_idx"
ON "Scholarship"("isActive", "status", "closesAt");
CREATE INDEX "Scholarship_countryId_idx" ON "Scholarship"("countryId");

DROP INDEX IF EXISTS "Scholarship_isActive_deadline_idx";

ALTER TABLE "Scholarship"
ADD CONSTRAINT "Scholarship_countryId_fkey"
FOREIGN KEY ("countryId") REFERENCES "Country"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ScholarshipUniversity" (
  "scholarshipId" TEXT NOT NULL,
  "universityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScholarshipUniversity_pkey"
  PRIMARY KEY ("scholarshipId", "universityId")
);

INSERT INTO "ScholarshipUniversity" ("scholarshipId", "universityId")
SELECT "id", "universityId"
FROM "Scholarship"
WHERE "universityId" IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX "ScholarshipUniversity_universityId_scholarshipId_idx"
ON "ScholarshipUniversity"("universityId", "scholarshipId");

ALTER TABLE "ScholarshipUniversity"
ADD CONSTRAINT "ScholarshipUniversity_scholarshipId_fkey"
FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScholarshipUniversity"
ADD CONSTRAINT "ScholarshipUniversity_universityId_fkey"
FOREIGN KEY ("universityId") REFERENCES "University"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ScholarshipAgent" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "logoUrl" TEXT,
  "name" TEXT NOT NULL,
  "company" TEXT,
  "countryId" TEXT,
  "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "specialties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "services" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "feeDetails" VARCHAR(500),
  "whatsapp" TEXT,
  "wechat" TEXT,
  "email" TEXT,
  "website" TEXT,
  "availability" "ScholarshipAgentAvailability" NOT NULL DEFAULT 'AVAILABLE',
  "averageRating" DOUBLE PRECISION,
  "biography" TEXT NOT NULL DEFAULT '',
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScholarshipAgent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScholarshipAgent_slug_key"
ON "ScholarshipAgent"("slug");
CREATE INDEX "ScholarshipAgent_isActive_verified_availability_name_idx"
ON "ScholarshipAgent"("isActive", "verified", "availability", "name");
CREATE INDEX "ScholarshipAgent_countryId_idx"
ON "ScholarshipAgent"("countryId");

ALTER TABLE "ScholarshipAgent"
ADD CONSTRAINT "ScholarshipAgent_countryId_fkey"
FOREIGN KEY ("countryId") REFERENCES "Country"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
