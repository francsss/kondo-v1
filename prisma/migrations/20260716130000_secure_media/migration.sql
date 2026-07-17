CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'DOCUMENT');
CREATE TYPE "MediaPurpose" AS ENUM (
  'PROFILE_AVATAR',
  'COMMUNITY_COVER',
  'POST_IMAGE',
  'LISTING_IMAGE',
  'GUIDE_COVER',
  'MESSAGE_IMAGE',
  'MESSAGE_DOCUMENT'
);
CREATE TYPE "MediaVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
CREATE TYPE "MediaStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'ACTIVE',
  'REJECTED',
  'REMOVED'
);
CREATE TYPE "MediaScanStatus" AS ENUM ('PENDING', 'CLEAN', 'FLAGGED', 'ERROR');
CREATE TYPE "MediaStorageProvider" AS ENUM ('LOCAL', 'S3');

CREATE TABLE "MediaAsset" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT,
  "objectKey" TEXT NOT NULL,
  "storageProvider" "MediaStorageProvider" NOT NULL,
  "kind" "MediaKind" NOT NULL,
  "purpose" "MediaPurpose" NOT NULL,
  "visibility" "MediaVisibility" NOT NULL,
  "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
  "scanStatus" "MediaScanStatus" NOT NULL DEFAULT 'PENDING',
  "originalFileName" VARCHAR(255) NOT NULL,
  "extension" VARCHAR(16) NOT NULL,
  "declaredMime" VARCHAR(120) NOT NULL,
  "detectedMime" VARCHAR(120),
  "sizeBytes" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "altText" VARCHAR(240),
  "checksumSha256" CHAR(64),
  "uploadExpiresAt" TIMESTAMP(3) NOT NULL,
  "uploadedAt" TIMESTAMP(3),
  "validatedAt" TIMESTAMP(3),
  "attachedAt" TIMESTAMP(3),
  "attachmentType" VARCHAR(80),
  "attachmentId" TEXT,
  "replacesId" TEXT,
  "rejectionReason" VARCHAR(500),
  "removedAt" TIMESTAMP(3),
  "removedById" TEXT,
  "storageDeletePending" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MediaAsset_size_positive_check" CHECK ("sizeBytes" > 0),
  CONSTRAINT "MediaAsset_dimensions_check" CHECK (
    ("kind" = 'DOCUMENT' AND "width" IS NULL AND "height" IS NULL)
    OR
    ("kind" = 'IMAGE' AND (
      "status" <> 'ACTIVE'
      OR ("width" IS NOT NULL AND "height" IS NOT NULL)
    ))
  ),
  CONSTRAINT "MediaAsset_active_validation_check" CHECK (
    "status" <> 'ACTIVE'
    OR (
      "scanStatus" = 'CLEAN'
      AND "detectedMime" IS NOT NULL
      AND "checksumSha256" IS NOT NULL
      AND "uploadedAt" IS NOT NULL
      AND "validatedAt" IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "MediaAsset_objectKey_key" ON "MediaAsset"("objectKey");
CREATE INDEX "MediaAsset_replacesId_idx" ON "MediaAsset"("replacesId");
CREATE INDEX "MediaAsset_ownerId_status_createdAt_idx"
ON "MediaAsset"("ownerId", "status", "createdAt");
CREATE INDEX "MediaAsset_status_uploadExpiresAt_idx"
ON "MediaAsset"("status", "uploadExpiresAt");
CREATE INDEX "MediaAsset_status_attachedAt_createdAt_idx"
ON "MediaAsset"("status", "attachedAt", "createdAt");
CREATE INDEX "MediaAsset_purpose_status_createdAt_idx"
ON "MediaAsset"("purpose", "status", "createdAt");
CREATE INDEX "MediaAsset_scanStatus_status_idx"
ON "MediaAsset"("scanStatus", "status");
CREATE INDEX "MediaAsset_attachmentType_attachmentId_idx"
ON "MediaAsset"("attachmentType", "attachmentId");

ALTER TABLE "MediaAsset"
ADD CONSTRAINT "MediaAsset_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MediaAsset"
ADD CONSTRAINT "MediaAsset_replacesId_fkey"
FOREIGN KEY ("replacesId") REFERENCES "MediaAsset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MediaAsset"
ADD CONSTRAINT "MediaAsset_removedById_fkey"
FOREIGN KEY ("removedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
