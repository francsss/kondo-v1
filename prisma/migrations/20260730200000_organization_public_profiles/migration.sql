-- Part 3: additive public organization profiles.
-- Existing organizations remain private until an authorized operator publishes them.

CREATE TYPE "OrganizationPublicProfileStatus" AS ENUM (
  'PRIVATE',
  'READY',
  'PUBLISHED',
  'UNPUBLISHED'
);

CREATE TYPE "OrganizationContactType" AS ENUM (
  'WEBSITE',
  'EMAIL',
  'PHONE',
  'WECHAT',
  'WHATSAPP',
  'OTHER'
);

CREATE TYPE "OrganizationContactVisibility" AS ENUM (
  'PUBLIC',
  'PRIVATE'
);

CREATE TYPE "OrganizationMediaKind" AS ENUM ('GALLERY');

ALTER TYPE "MediaPurpose"
  ADD VALUE IF NOT EXISTS 'ORGANIZATION_GALLERY_IMAGE';

ALTER TYPE "ReportEvidenceKind"
  ADD VALUE IF NOT EXISTS 'ORGANIZATION_SNAPSHOT';

ALTER TABLE "Organization"
  ADD COLUMN "publicProfileStatus" "OrganizationPublicProfileStatus" NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN "representationConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "unpublishedAt" TIMESTAMP(3),
  ADD COLUMN "lastPublicUpdateAt" TIMESTAMP(3),
  ADD COLUMN "publicationVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "publicProfileBlockedAt" TIMESTAMP(3),
  ADD COLUMN "publicProfileBlockReason" VARCHAR(1200),
  ADD COLUMN "correctionRequestedAt" TIMESTAMP(3);

UPDATE "Organization"
SET "representationConfirmedAt" = "setupCompletedAt"
WHERE "setupCompletedAt" IS NOT NULL;

CREATE TABLE "OrganizationContactChannel" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" "OrganizationContactType" NOT NULL,
  "label" VARCHAR(80),
  "value" VARCHAR(500) NOT NULL,
  "visibility" "OrganizationContactVisibility" NOT NULL DEFAULT 'PRIVATE',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganizationContactChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationMedia" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "kind" "OrganizationMediaKind" NOT NULL DEFAULT 'GALLERY',
  "caption" VARCHAR(240),
  "altText" VARCHAR(240) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "visibility" "OrganizationContactVisibility" NOT NULL DEFAULT 'PRIVATE',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganizationMedia_pkey" PRIMARY KEY ("id")
);

INSERT INTO "OrganizationContactChannel" (
  "id",
  "organizationId",
  "type",
  "label",
  "value",
  "visibility",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  'legacy-website-' || "id",
  "id",
  'WEBSITE',
  'Official website',
  "website",
  CASE WHEN "contactAudience" = 'PUBLIC'
    THEN 'PUBLIC'::"OrganizationContactVisibility"
    ELSE 'PRIVATE'::"OrganizationContactVisibility"
  END,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization"
WHERE "website" IS NOT NULL AND btrim("website") <> '';

INSERT INTO "OrganizationContactChannel" (
  "id", "organizationId", "type", "label", "value", "visibility",
  "sortOrder", "createdAt", "updatedAt"
)
SELECT
  'legacy-email-' || "id",
  "id",
  'EMAIL',
  'Professional email',
  "professionalEmail",
  CASE WHEN "contactAudience" = 'PUBLIC'
    THEN 'PUBLIC'::"OrganizationContactVisibility"
    ELSE 'PRIVATE'::"OrganizationContactVisibility"
  END,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization"
WHERE "professionalEmail" IS NOT NULL AND btrim("professionalEmail") <> '';

INSERT INTO "OrganizationContactChannel" (
  "id", "organizationId", "type", "label", "value", "visibility",
  "sortOrder", "createdAt", "updatedAt"
)
SELECT
  'legacy-phone-' || "id",
  "id",
  'PHONE',
  'Professional phone',
  "professionalPhone",
  CASE WHEN "contactAudience" = 'PUBLIC'
    THEN 'PUBLIC'::"OrganizationContactVisibility"
    ELSE 'PRIVATE'::"OrganizationContactVisibility"
  END,
  2,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization"
WHERE "professionalPhone" IS NOT NULL AND btrim("professionalPhone") <> '';

INSERT INTO "OrganizationContactChannel" (
  "id", "organizationId", "type", "label", "value", "visibility",
  "sortOrder", "createdAt", "updatedAt"
)
SELECT
  'legacy-wechat-' || "id",
  "id",
  'WECHAT',
  'WeChat',
  "websiteWechat",
  CASE WHEN "contactAudience" = 'PUBLIC'
    THEN 'PUBLIC'::"OrganizationContactVisibility"
    ELSE 'PRIVATE'::"OrganizationContactVisibility"
  END,
  3,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization"
WHERE "websiteWechat" IS NOT NULL AND btrim("websiteWechat") <> '';

CREATE UNIQUE INDEX "OrganizationMedia_mediaId_key"
  ON "OrganizationMedia"("mediaId");
CREATE INDEX "OrganizationContactChannel_org_visibility_sort_idx"
  ON "OrganizationContactChannel"("organizationId", "visibility", "sortOrder");
CREATE INDEX "OrganizationContactChannel_org_type_idx"
  ON "OrganizationContactChannel"("organizationId", "type");
CREATE INDEX "OrganizationMedia_org_visibility_sort_idx"
  ON "OrganizationMedia"("organizationId", "visibility", "sortOrder");
CREATE INDEX "OrganizationMedia_createdById_createdAt_idx"
  ON "OrganizationMedia"("createdById", "createdAt");
CREATE INDEX "Organization_publicProfileStatus_lifecycle_updatedAt_idx"
  ON "Organization"("publicProfileStatus", "lifecycleStatus", "updatedAt");
CREATE INDEX "Organization_cityId_publicProfileStatus_lifecycle_idx"
  ON "Organization"("cityId", "publicProfileStatus", "lifecycleStatus");
CREATE INDEX "Organization_countryId_publicProfileStatus_lifecycle_idx"
  ON "Organization"("countryId", "publicProfileStatus", "lifecycleStatus");

ALTER TABLE "OrganizationContactChannel"
  ADD CONSTRAINT "OrganizationContactChannel_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMedia"
  ADD CONSTRAINT "OrganizationMedia_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMedia"
  ADD CONSTRAINT "OrganizationMedia_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationMedia"
  ADD CONSTRAINT "OrganizationMedia_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Organization"
ADD COLUMN "searchVector" tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce("publicName", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("tagline", '')), 'B') ||
  setweight(to_tsvector('simple', coalesce("shortDescription", '')), 'B')
) STORED;

CREATE INDEX "Organization_searchVector_idx"
  ON "Organization" USING GIN ("searchVector");

INSERT INTO "NotificationTemplate" (
  "key",
  "type",
  "titleTemplate",
  "bodyTemplate",
  "isActive",
  "version",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    'ORGANIZATION_PUBLIC_PROFILE_STATUS',
    'ACCOUNT',
    'Organization public profile',
    '{{organizationName}}: {{outcome}}.',
    true,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'ORGANIZATION_PUBLIC_PROFILE_CORRECTION',
    'MODERATION_UPDATE',
    'Organization profile update requested',
    '{{organizationName}}: {{outcome}}.',
    true,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("key") DO NOTHING;
