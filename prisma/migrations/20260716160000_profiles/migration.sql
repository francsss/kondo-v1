ALTER TYPE "ReportEvidenceKind" ADD VALUE 'PROFILE_SNAPSHOT';

CREATE TYPE "ProfileAudience" AS ENUM ('PUBLIC', 'MEMBERS', 'PRIVATE');
CREATE TYPE "AccountRequestType" AS ENUM ('DATA_EXPORT', 'ACCOUNT_DELETION');
CREATE TYPE "AccountRequestStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'REJECTED',
  'CANCELLED'
);

ALTER TABLE "User"
ADD COLUMN "avatarMediaId" TEXT,
ADD COLUMN "profileAudience" "ProfileAudience" NOT NULL DEFAULT 'MEMBERS',
ADD COLUMN "locationAudience" "ProfileAudience" NOT NULL DEFAULT 'MEMBERS',
ADD COLUMN "educationAudience" "ProfileAudience" NOT NULL DEFAULT 'MEMBERS',
ADD COLUMN "languagesAudience" "ProfileAudience" NOT NULL DEFAULT 'MEMBERS',
ADD COLUMN "communitiesAudience" "ProfileAudience" NOT NULL DEFAULT 'MEMBERS',
ADD COLUMN "activityAudience" "ProfileAudience" NOT NULL DEFAULT 'MEMBERS',
ADD COLUMN "marketplaceAudience" "ProfileAudience" NOT NULL DEFAULT 'MEMBERS';

CREATE UNIQUE INDEX "User_avatarMediaId_key" ON "User"("avatarMediaId");
CREATE INDEX "User_profileAudience_status_idx"
ON "User"("profileAudience", "status");

ALTER TABLE "User"
ADD CONSTRAINT "User_avatarMediaId_fkey"
FOREIGN KEY ("avatarMediaId") REFERENCES "MediaAsset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AccountRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "AccountRequestType" NOT NULL,
  "status" "AccountRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" VARCHAR(1000),
  "responseNote" VARCHAR(2000),
  "version" INTEGER NOT NULL DEFAULT 1,
  "processedById" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccountRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountRequest_version_check" CHECK ("version" > 0),
  CONSTRAINT "AccountRequest_processing_check" CHECK (
    (
      "status" IN ('PENDING', 'CANCELLED')
      AND "processedAt" IS NULL
      AND "processedById" IS NULL
    )
    OR
    (
      "status" IN ('PROCESSING', 'COMPLETED', 'REJECTED')
      AND "processedAt" IS NOT NULL
      AND "processedById" IS NOT NULL
    )
  )
);

CREATE INDEX "AccountRequest_userId_createdAt_idx"
ON "AccountRequest"("userId", "createdAt");
CREATE INDEX "AccountRequest_status_type_createdAt_idx"
ON "AccountRequest"("status", "type", "createdAt");
CREATE INDEX "AccountRequest_processedById_status_idx"
ON "AccountRequest"("processedById", "status");

CREATE UNIQUE INDEX "AccountRequest_active_user_type_key"
ON "AccountRequest"("userId", "type")
WHERE "status" IN ('PENDING', 'PROCESSING');

ALTER TABLE "AccountRequest"
ADD CONSTRAINT "AccountRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountRequest"
ADD CONSTRAINT "AccountRequest_processedById_fkey"
FOREIGN KEY ("processedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Report_active_profile_reporter_target_key"
ON "Report"("reporterId", "targetType", "targetId")
WHERE
  "reporterId" IS NOT NULL
  AND "targetType" = 'UserProfile'
  AND "status" IN ('OPEN', 'REVIEWING');
