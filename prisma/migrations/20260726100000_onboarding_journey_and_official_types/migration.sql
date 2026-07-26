-- Personalize onboarding without changing existing completed profiles.
CREATE TYPE "StudentJourney" AS ENUM (
  'CURRENT_STUDENT',
  'INCOMING_STUDENT',
  'ALUMNI'
);

ALTER TABLE "User"
ADD COLUMN "studentJourney" "StudentJourney";

-- Expand the existing trust taxonomy while preserving all issued marks.
ALTER TYPE "OfficialOrganizationType" ADD VALUE IF NOT EXISTS 'EMBASSY';
ALTER TYPE "OfficialOrganizationType" ADD VALUE IF NOT EXISTS 'ORGANIZATION';
ALTER TYPE "OfficialOrganizationType" ADD VALUE IF NOT EXISTS 'ADMINISTRATOR';
