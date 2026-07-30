-- Part 3: additive public organization profiles.
-- Existing organizations remain private until an authorized operator publishes them.

-- A previous production attempt may have created some enum types before
-- stopping. Keep the migration safe to resume without deleting live data.
DO $$
BEGIN
  CREATE TYPE "OrganizationPublicProfileStatus" AS ENUM (
    'PRIVATE',
    'READY',
    'PUBLISHED',
    'UNPUBLISHED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "OrganizationContactType" AS ENUM (
    'WEBSITE',
    'EMAIL',
    'PHONE',
    'WECHAT',
    'WHATSAPP',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "OrganizationContactVisibility" AS ENUM (
    'PUBLIC',
    'PRIVATE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "OrganizationMediaKind" AS ENUM ('GALLERY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TYPE "MediaPurpose"
  ADD VALUE IF NOT EXISTS 'ORGANIZATION_GALLERY_IMAGE';

ALTER TYPE "ReportEvidenceKind"
  ADD VALUE IF NOT EXISTS 'ORGANIZATION_SNAPSHOT';

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "publicProfileStatus" "OrganizationPublicProfileStatus" NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN IF NOT EXISTS "representationConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unpublishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastPublicUpdateAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "publicationVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "publicProfileBlockedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "publicProfileBlockReason" VARCHAR(1200),
  ADD COLUMN IF NOT EXISTS "correctionRequestedAt" TIMESTAMP(3);

UPDATE "Organization"
SET "representationConfirmedAt" = "setupCompletedAt"
WHERE "setupCompletedAt" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "OrganizationContactChannel" (
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

CREATE TABLE IF NOT EXISTS "OrganizationMedia" (
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
WHERE "website" IS NOT NULL AND btrim("website") <> ''
ON CONFLICT ("id") DO NOTHING;

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
WHERE "professionalEmail" IS NOT NULL AND btrim("professionalEmail") <> ''
ON CONFLICT ("id") DO NOTHING;

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
WHERE "professionalPhone" IS NOT NULL AND btrim("professionalPhone") <> ''
ON CONFLICT ("id") DO NOTHING;

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
WHERE "websiteWechat" IS NOT NULL AND btrim("websiteWechat") <> ''
ON CONFLICT ("id") DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationMedia_mediaId_key"
  ON "OrganizationMedia"("mediaId");
CREATE INDEX IF NOT EXISTS "OrganizationContactChannel_org_visibility_sort_idx"
  ON "OrganizationContactChannel"("organizationId", "visibility", "sortOrder");
CREATE INDEX IF NOT EXISTS "OrganizationContactChannel_org_type_idx"
  ON "OrganizationContactChannel"("organizationId", "type");
CREATE INDEX IF NOT EXISTS "OrganizationMedia_org_visibility_sort_idx"
  ON "OrganizationMedia"("organizationId", "visibility", "sortOrder");
CREATE INDEX IF NOT EXISTS "OrganizationMedia_createdById_createdAt_idx"
  ON "OrganizationMedia"("createdById", "createdAt");
CREATE INDEX IF NOT EXISTS "Organization_publicProfileStatus_lifecycle_updatedAt_idx"
  ON "Organization"("publicProfileStatus", "lifecycleStatus", "updatedAt");
CREATE INDEX IF NOT EXISTS "Organization_cityId_publicProfileStatus_lifecycle_idx"
  ON "Organization"("cityId", "publicProfileStatus", "lifecycleStatus");
CREATE INDEX IF NOT EXISTS "Organization_countryId_publicProfileStatus_lifecycle_idx"
  ON "Organization"("countryId", "publicProfileStatus", "lifecycleStatus");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'OrganizationContactChannel_organizationId_fkey'
      AND conrelid = '"OrganizationContactChannel"'::regclass
  ) THEN
    ALTER TABLE "OrganizationContactChannel"
      ADD CONSTRAINT "OrganizationContactChannel_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'OrganizationMedia_organizationId_fkey'
      AND conrelid = '"OrganizationMedia"'::regclass
  ) THEN
    ALTER TABLE "OrganizationMedia"
      ADD CONSTRAINT "OrganizationMedia_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'OrganizationMedia_mediaId_fkey'
      AND conrelid = '"OrganizationMedia"'::regclass
  ) THEN
    ALTER TABLE "OrganizationMedia"
      ADD CONSTRAINT "OrganizationMedia_mediaId_fkey"
      FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'OrganizationMedia_createdById_fkey'
      AND conrelid = '"OrganizationMedia"'::regclass
  ) THEN
    ALTER TABLE "OrganizationMedia"
      ADD CONSTRAINT "OrganizationMedia_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

ALTER TABLE "Organization"
ADD COLUMN IF NOT EXISTS "searchVector" tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce("publicName", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("tagline", '')), 'B') ||
  setweight(to_tsvector('simple', coalesce("shortDescription", '')), 'B')
) STORED;

CREATE INDEX IF NOT EXISTS "Organization_searchVector_idx"
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
