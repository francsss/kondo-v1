-- Where Guide information comes from, and when anyone last checked it.
--
-- Guide already carried a `published` flag, and that was the whole of it. Four
-- guides were live covering residence permits, bank accounts and healthcare —
-- the topics a student is most likely to act on and least able to check — with
-- no source recorded, no reviewer, and no date. A reader had no way to tell
-- maintained information from something written once and forgotten.
--
-- Publication and verification are now separate, because they answer different
-- questions. `published` decides whether a guide is visible; `contentStatus`
-- decides whether Kondo is willing to stand behind it. Existing guides become
-- NEEDS_REVIEW rather than VERIFIED: nobody has actually verified them, and
-- defaulting them to verified would manufacture exactly the false confidence
-- this table exists to prevent. They stay visible; they simply stop claiming
-- an authority they never had.

CREATE TYPE "GuideContentStatus" AS ENUM (
  'DRAFT',
  'NEEDS_REVIEW',
  'VERIFIED',
  'ARCHIVED'
);

ALTER TABLE "Guide"
  ADD COLUMN IF NOT EXISTS "contentStatus" "GuideContentStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
  -- When a human last checked this against its sources. Null means never.
  ADD COLUMN IF NOT EXISTS "lastVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastVerifiedById" TEXT,
  -- When it should be looked at again. Rules change; a date makes that visible.
  ADD COLUMN IF NOT EXISTS "reviewDueAt" TIMESTAMP(3),
  -- Optional targeting. Null means the guide applies China-wide, which is the
  -- default and should stay the common case: a country-specific guide is only
  -- worth having when the difference has actually been established.
  ADD COLUMN IF NOT EXISTS "countryId" TEXT,
  ADD COLUMN IF NOT EXISTS "cityId" TEXT,
  ADD COLUMN IF NOT EXISTS "universityId" TEXT;

ALTER TABLE "Guide"
  ADD CONSTRAINT "Guide_lastVerifiedById_fkey"
    FOREIGN KEY ("lastVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "Guide_countryId_fkey"
    FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "Guide_cityId_fkey"
    FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "Guide_universityId_fkey"
    FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "Guide_contentStatus_published_idx"
  ON "Guide" ("contentStatus", "published");
CREATE INDEX IF NOT EXISTS "Guide_countryId_idx" ON "Guide" ("countryId");
CREATE INDEX IF NOT EXISTS "Guide_cityId_idx" ON "Guide" ("cityId");
CREATE INDEX IF NOT EXISTS "Guide_universityId_idx" ON "Guide" ("universityId");

-- A citation. Separate rows rather than a JSON blob so a source can be listed,
-- counted and checked, and so "which guides cite this page?" is a query.
CREATE TABLE "GuideSource" (
  "id" TEXT NOT NULL,
  "guideId" TEXT NOT NULL,
  "title" VARCHAR(300) NOT NULL,
  "url" VARCHAR(2048) NOT NULL,
  -- Who publishes it: a ministry, a university, the app's own documentation.
  "organization" VARCHAR(200),
  -- An official primary source outranks commentary about one, and the reader
  -- is told which they are looking at.
  "isOfficial" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GuideSource_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GuideSource"
  ADD CONSTRAINT "GuideSource_guideId_fkey"
    FOREIGN KEY ("guideId") REFERENCES "Guide"("id") ON DELETE CASCADE;

CREATE INDEX "GuideSource_guideId_sortOrder_idx"
  ON "GuideSource" ("guideId", "sortOrder");
