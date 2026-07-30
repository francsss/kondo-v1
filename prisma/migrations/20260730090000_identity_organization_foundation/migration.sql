-- Part 1: additive identity, personal journey, and organization foundation.
-- Existing users, sessions, journey values, and community memberships remain unchanged.

ALTER TYPE "StudentJourney" ADD VALUE IF NOT EXISTS 'PROSPECTIVE_STUDENT';
ALTER TYPE "StudentJourney" ADD VALUE IF NOT EXISTS 'ADMITTED_STUDENT';
ALTER TYPE "StudentJourney" ADD VALUE IF NOT EXISTS 'PROFESSIONAL';

CREATE TYPE "OnboardingIntent" AS ENUM ('PERSONAL', 'ORGANIZATION');
CREATE TYPE "ProspectiveApplicationStage" AS ENUM (
  'EXPLORING',
  'SEARCHING_SCHOLARSHIPS',
  'PREPARING_APPLICATION',
  'APPLICATION_SUBMITTED',
  'WAITING_FOR_DECISION',
  'ADMITTED',
  'PREPARING_ARRIVAL'
);
CREATE TYPE "UniversityPreferenceMode" AS ENUM (
  'NOT_CHOSEN',
  'CONSIDERING_SEVERAL',
  'PREFERRED_SELECTED'
);
CREATE TYPE "OrganizationType" AS ENUM (
  'COMPANY',
  'UNIVERSITY',
  'EDUCATION_AGENCY',
  'HOUSING_PROVIDER',
  'STUDENT_ASSOCIATION',
  'EMBASSY_OR_CONSULATE',
  'RECRUITMENT_ORGANIZATION',
  'SERVICE_PROVIDER',
  'OTHER'
);
CREATE TYPE "OrganizationLifecycleStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED'
);
CREATE TYPE "OrganizationVerificationStatus" AS ENUM (
  'NOT_SUBMITTED',
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'MORE_INFORMATION_REQUIRED'
);
CREATE TYPE "OrganizationMembershipRole" AS ENUM (
  'OWNER',
  'ADMIN',
  'MANAGER',
  'MEMBER'
);
CREATE TYPE "OrganizationMembershipStatus" AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'LEFT',
  'REMOVED'
);
CREATE TYPE "OrganizationCapabilityKey" AS ENUM (
  'HOUSING',
  'SCHOLARSHIPS',
  'INTERNSHIPS_JOBS',
  'PRODUCTS',
  'STUDENT_SERVICES',
  'EVENTS',
  'UNIVERSITY_INFORMATION'
);
CREATE TYPE "OrganizationCapabilityStatus" AS ENUM (
  'ENABLED',
  'DISABLED',
  'RESTRICTED'
);

ALTER TYPE "MediaPurpose" ADD VALUE IF NOT EXISTS 'ORGANIZATION_LOGO';

ALTER TABLE "User"
ADD COLUMN "onboardingIntent" "OnboardingIntent";

CREATE TABLE "UserJourneyDetail" (
  "userId" TEXT NOT NULL,
  "applicationStage" "ProspectiveApplicationStage",
  "universityPreferenceMode" "UniversityPreferenceMode",
  "expectedIntake" DATE,
  "campusName" VARCHAR(160),
  "graduationYear" INTEGER,
  "professionalArea" VARCHAR(160),
  "currentCityName" VARCHAR(160),
  "chinaRelationship" VARCHAR(500),
  "currentProfessionalContext" VARCHAR(500),
  "arrivalPreparationContext" VARCHAR(500),
  "onboardingStep" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserJourneyDetail_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "UserJourneyDetail_onboardingStep_check"
    CHECK ("onboardingStep" BETWEEN 0 AND 5),
  CONSTRAINT "UserJourneyDetail_graduationYear_check"
    CHECK ("graduationYear" IS NULL OR "graduationYear" BETWEEN 1900 AND 2200)
);

CREATE TABLE "UserTargetCity" (
  "userId" TEXT NOT NULL,
  "cityId" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserTargetCity_pkey" PRIMARY KEY ("userId", "cityId")
);

CREATE TABLE "UserTargetUniversity" (
  "userId" TEXT NOT NULL,
  "universityId" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserTargetUniversity_pkey" PRIMARY KEY ("userId", "universityId")
);

CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "publicName" VARCHAR(160) NOT NULL,
  "legalName" VARCHAR(200),
  "slug" VARCHAR(120) NOT NULL,
  "type" "OrganizationType" NOT NULL,
  "shortDescription" VARCHAR(500),
  "countryId" TEXT NOT NULL,
  "cityId" TEXT,
  "website" VARCHAR(500),
  "professionalEmail" VARCHAR(320),
  "professionalPhone" VARCHAR(40),
  "logoMediaId" TEXT,
  "lifecycleStatus" "OrganizationLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  "verificationStatus" "OrganizationVerificationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
  "setupStep" INTEGER NOT NULL DEFAULT 1,
  "setupCompletedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Organization_setupStep_check" CHECK ("setupStep" BETWEEN 1 AND 4)
);

CREATE TABLE "OrganizationMembership" (
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "OrganizationMembershipRole" NOT NULL,
  "status" "OrganizationMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganizationMembership_pkey"
    PRIMARY KEY ("organizationId", "userId")
);

CREATE TABLE "OrganizationCapability" (
  "organizationId" TEXT NOT NULL,
  "key" "OrganizationCapabilityKey" NOT NULL,
  "status" "OrganizationCapabilityStatus" NOT NULL DEFAULT 'ENABLED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganizationCapability_pkey"
    PRIMARY KEY ("organizationId", "key")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "Organization_logoMediaId_key" ON "Organization"("logoMediaId");
CREATE INDEX "Organization_createdById_lifecycleStatus_updatedAt_idx"
  ON "Organization"("createdById", "lifecycleStatus", "updatedAt");
CREATE INDEX "Organization_countryId_cityId_idx"
  ON "Organization"("countryId", "cityId");
CREATE INDEX "Organization_lifecycleStatus_verificationStatus_idx"
  ON "Organization"("lifecycleStatus", "verificationStatus");
CREATE INDEX "OrganizationMembership_userId_status_updatedAt_idx"
  ON "OrganizationMembership"("userId", "status", "updatedAt");
CREATE INDEX "OrganizationMembership_organizationId_role_status_idx"
  ON "OrganizationMembership"("organizationId", "role", "status");
CREATE UNIQUE INDEX "OrganizationMembership_one_active_owner_per_org"
  ON "OrganizationMembership"("organizationId")
  WHERE "role" = 'OWNER' AND "status" = 'ACTIVE';
CREATE INDEX "OrganizationCapability_key_status_idx"
  ON "OrganizationCapability"("key", "status");
CREATE INDEX "UserTargetCity_userId_displayOrder_idx"
  ON "UserTargetCity"("userId", "displayOrder");
CREATE INDEX "UserTargetCity_cityId_idx" ON "UserTargetCity"("cityId");
CREATE INDEX "UserTargetUniversity_userId_displayOrder_idx"
  ON "UserTargetUniversity"("userId", "displayOrder");
CREATE INDEX "UserTargetUniversity_universityId_idx"
  ON "UserTargetUniversity"("universityId");

ALTER TABLE "UserJourneyDetail"
ADD CONSTRAINT "UserJourneyDetail_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTargetCity"
ADD CONSTRAINT "UserTargetCity_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTargetCity"
ADD CONSTRAINT "UserTargetCity_cityId_fkey"
FOREIGN KEY ("cityId") REFERENCES "City"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTargetUniversity"
ADD CONSTRAINT "UserTargetUniversity_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTargetUniversity"
ADD CONSTRAINT "UserTargetUniversity_universityId_fkey"
FOREIGN KEY ("universityId") REFERENCES "University"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Organization"
ADD CONSTRAINT "Organization_countryId_fkey"
FOREIGN KEY ("countryId") REFERENCES "Country"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Organization"
ADD CONSTRAINT "Organization_cityId_fkey"
FOREIGN KEY ("cityId") REFERENCES "City"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Organization"
ADD CONSTRAINT "Organization_logoMediaId_fkey"
FOREIGN KEY ("logoMediaId") REFERENCES "MediaAsset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Organization"
ADD CONSTRAINT "Organization_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationMembership"
ADD CONSTRAINT "OrganizationMembership_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationMembership"
ADD CONSTRAINT "OrganizationMembership_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationCapability"
ADD CONSTRAINT "OrganizationCapability_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- An organization city, when present, must belong to the selected country.
CREATE FUNCTION "kondo_validate_organization_location"()
RETURNS trigger AS $$
BEGIN
  IF NEW."cityId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "City"
    WHERE "id" = NEW."cityId"
      AND "countryId" = NEW."countryId"
  ) THEN
    RAISE EXCEPTION 'Organization city must belong to its selected country.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Organization_location_guard_trigger"
BEFORE INSERT OR UPDATE OF "countryId", "cityId" ON "Organization"
FOR EACH ROW
EXECUTE FUNCTION "kondo_validate_organization_location"();

-- The partial unique index above enforces at most one active owner. These
-- deferred constraint triggers enforce the matching "at least one" invariant
-- after all nested Prisma writes in a transaction have completed.
CREATE FUNCTION "kondo_validate_organization_owner"()
RETURNS trigger AS $$
DECLARE
  target_organization_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'Organization' THEN
    IF TG_OP = 'DELETE' THEN
      target_organization_id := OLD."id";
    ELSE
      target_organization_id := NEW."id";
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      target_organization_id := OLD."organizationId";
    ELSE
      target_organization_id := NEW."organizationId";
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Organization" WHERE "id" = target_organization_id
  ) AND (
    SELECT COUNT(*)
    FROM "OrganizationMembership"
    WHERE "organizationId" = target_organization_id
      AND "role" = 'OWNER'
      AND "status" = 'ACTIVE'
  ) <> 1 THEN
    RAISE EXCEPTION 'Organization must have exactly one active owner.';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "Organization_owner_guard_from_organization"
AFTER INSERT OR UPDATE ON "Organization"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "kondo_validate_organization_owner"();

CREATE CONSTRAINT TRIGGER "Organization_owner_guard_from_membership"
AFTER INSERT OR UPDATE OR DELETE ON "OrganizationMembership"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "kondo_validate_organization_owner"();
