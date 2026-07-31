-- Part 4: additive Housing, Housing request, and roommate domain.
-- Marketplace records, City Hub snapshots, organizations, users, media, and
-- conversations remain unchanged.

CREATE TYPE "HousingPublisherType" AS ENUM ('PERSONAL', 'ORGANIZATION');
CREATE TYPE "HousingListingType" AS ENUM (
  'ENTIRE_APARTMENT',
  'PRIVATE_ROOM',
  'SHARED_ROOM',
  'STUDENT_RESIDENCE',
  'UNIVERSITY_DORMITORY',
  'STUDIO',
  'HOUSE',
  'ROOMMATE_REPLACEMENT',
  'SUBLET',
  'OTHER'
);
CREATE TYPE "HousingListingStatus" AS ENUM (
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'PAUSED',
  'RENTED',
  'EXPIRED',
  'REJECTED',
  'REMOVED',
  'ARCHIVED'
);
CREATE TYPE "HousingLocationPrivacy" AS ENUM (
  'APPROXIMATE_AREA',
  'NEAR_UNIVERSITY',
  'DISTRICT_ONLY',
  'EXACT_AFTER_CONTACT',
  'PUBLIC_EXACT_LOCATION'
);
CREATE TYPE "HousingFurnishing" AS ENUM (
  'FURNISHED',
  'PARTLY_FURNISHED',
  'UNFURNISHED',
  'UNKNOWN'
);
CREATE TYPE "HousingPolicyPreference" AS ENUM (
  'ALLOWED',
  'NOT_ALLOWED',
  'CASE_BY_CASE',
  'NOT_SPECIFIED'
);
CREATE TYPE "HousingListingMediaKind" AS ENUM (
  'COVER',
  'GALLERY',
  'FLOOR_PLAN',
  'PROOF_DOCUMENT'
);
CREATE TYPE "HousingInquiryStatus" AS ENUM ('OPEN', 'RESPONDED', 'CLOSED');
CREATE TYPE "HousingRequestStatus" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'PAUSED',
  'MATCHED',
  'EXPIRED',
  'ARCHIVED',
  'REMOVED'
);
CREATE TYPE "HousingRequestVisibility" AS ENUM (
  'PUBLIC',
  'MEMBERS_ONLY',
  'MATCHING_ONLY'
);
CREATE TYPE "RoommateProfileStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PAUSED');
CREATE TYPE "RoommateProfileVisibility" AS ENUM ('MEMBERS_ONLY', 'PRIVATE');
CREATE TYPE "RoommateInterestStatus" AS ENUM (
  'SENT',
  'ACCEPTED',
  'DECLINED',
  'WITHDRAWN',
  'EXPIRED',
  'BLOCKED'
);

ALTER TABLE "UserPreference"
  ADD COLUMN "notificationHousing" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "HousingListing" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "publisherType" "HousingPublisherType" NOT NULL,
  "publisherUserId" TEXT,
  "publisherOrganizationId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "representativeUserId" TEXT,
  "type" "HousingListingType" NOT NULL,
  "status" "HousingListingStatus" NOT NULL DEFAULT 'DRAFT',
  "title" VARCHAR(160) NOT NULL,
  "shortDescription" VARCHAR(320) NOT NULL,
  "description" TEXT NOT NULL,
  "houseRules" VARCHAR(2000),
  "neighborhoodContext" VARCHAR(1200),
  "transportContext" VARCHAR(1200),
  "universityContext" VARCHAR(1200),
  "countryId" TEXT NOT NULL,
  "cityId" TEXT NOT NULL,
  "district" VARCHAR(160),
  "universityId" TEXT,
  "publicLocationLabel" VARCHAR(240) NOT NULL,
  "privateAddress" VARCHAR(500),
  "exactLatitude" DECIMAL(10,7),
  "exactLongitude" DECIMAL(10,7),
  "publicLatitude" DECIMAL(10,7),
  "publicLongitude" DECIMAL(10,7),
  "locationPrivacy" "HousingLocationPrivacy" NOT NULL DEFAULT 'APPROXIMATE_AREA',
  "monthlyRentMinor" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'CNY',
  "depositMinor" INTEGER,
  "utilitiesMinor" INTEGER,
  "agencyFeeMinor" INTEGER,
  "serviceFeeMinor" INTEGER,
  "otherCostsDescription" VARCHAR(800),
  "paymentPeriod" VARCHAR(80),
  "negotiable" BOOLEAN NOT NULL DEFAULT false,
  "bedrooms" INTEGER,
  "bathrooms" DOUBLE PRECISION,
  "sizeSquareMeters" DOUBLE PRECISION,
  "furnishing" "HousingFurnishing" NOT NULL DEFAULT 'UNKNOWN',
  "floor" VARCHAR(40),
  "occupancy" INTEGER,
  "availablePlaces" INTEGER NOT NULL DEFAULT 1,
  "availableFrom" DATE NOT NULL,
  "leaseEnd" DATE,
  "minimumStayMonths" INTEGER,
  "maximumStayMonths" INTEGER,
  "smokingPolicy" "HousingPolicyPreference" NOT NULL DEFAULT 'NOT_SPECIFIED',
  "petPolicy" "HousingPolicyPreference" NOT NULL DEFAULT 'NOT_SPECIFIED',
  "genderPreference" "UserGender",
  "accessibilityDetails" VARCHAR(1000),
  "contactPreference" VARCHAR(40) NOT NULL DEFAULT 'KONDO_MESSAGE',
  "publicContactEnabled" BOOLEAN NOT NULL DEFAULT false,
  "accuracyConfirmedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "rentedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "moderatedAt" TIMESTAMP(3),
  "moderatedByUserId" TEXT,
  "moderationReason" VARCHAR(1200),
  "internalModerationNote" VARCHAR(2000),
  "publicationBlockedAt" TIMESTAMP(3),
  "publicationBlockReason" VARCHAR(1200),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "searchVector" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("shortDescription", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("description", '')), 'C') ||
    setweight(to_tsvector('simple', coalesce("district", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("publicLocationLabel", '')), 'B')
  ) STORED,

  CONSTRAINT "HousingListing_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HousingListing_exactly_one_publisher_check" CHECK (
    (
      "publisherType" = 'PERSONAL'
      AND "publisherUserId" IS NOT NULL
      AND "publisherOrganizationId" IS NULL
    )
    OR
    (
      "publisherType" = 'ORGANIZATION'
      AND "publisherUserId" IS NULL
      AND "publisherOrganizationId" IS NOT NULL
    )
  ),
  CONSTRAINT "HousingListing_price_check"
    CHECK ("monthlyRentMinor" >= 0),
  CONSTRAINT "HousingListing_costs_check" CHECK (
    ("depositMinor" IS NULL OR "depositMinor" >= 0)
    AND ("utilitiesMinor" IS NULL OR "utilitiesMinor" >= 0)
    AND ("agencyFeeMinor" IS NULL OR "agencyFeeMinor" >= 0)
    AND ("serviceFeeMinor" IS NULL OR "serviceFeeMinor" >= 0)
  ),
  CONSTRAINT "HousingListing_capacity_check" CHECK (
    "availablePlaces" BETWEEN 1 AND 100
    AND ("bedrooms" IS NULL OR "bedrooms" BETWEEN 0 AND 100)
    AND ("bathrooms" IS NULL OR "bathrooms" BETWEEN 0 AND 100)
    AND ("occupancy" IS NULL OR "occupancy" BETWEEN 0 AND 100)
  ),
  CONSTRAINT "HousingListing_stay_check" CHECK (
    ("minimumStayMonths" IS NULL OR "minimumStayMonths" BETWEEN 1 AND 120)
    AND ("maximumStayMonths" IS NULL OR "maximumStayMonths" BETWEEN 1 AND 120)
    AND (
      "minimumStayMonths" IS NULL
      OR "maximumStayMonths" IS NULL
      OR "minimumStayMonths" <= "maximumStayMonths"
    )
  ),
  CONSTRAINT "HousingListing_coordinate_pairs_check" CHECK (
    ("exactLatitude" IS NULL) = ("exactLongitude" IS NULL)
    AND ("publicLatitude" IS NULL) = ("publicLongitude" IS NULL)
  ),
  CONSTRAINT "HousingListing_coordinate_bounds_check" CHECK (
    ("exactLatitude" IS NULL OR "exactLatitude" BETWEEN -90 AND 90)
    AND ("exactLongitude" IS NULL OR "exactLongitude" BETWEEN -180 AND 180)
    AND ("publicLatitude" IS NULL OR "publicLatitude" BETWEEN -90 AND 90)
    AND ("publicLongitude" IS NULL OR "publicLongitude" BETWEEN -180 AND 180)
  ),
  CONSTRAINT "HousingListing_personal_location_privacy_check" CHECK (
    "publisherType" <> 'PERSONAL'
    OR "locationPrivacy" <> 'PUBLIC_EXACT_LOCATION'
  )
);

CREATE TABLE "HousingListingMedia" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "kind" "HousingListingMediaKind" NOT NULL DEFAULT 'GALLERY',
  "caption" VARCHAR(240),
  "altText" VARCHAR(240) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isCover" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HousingListingMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HousingListingAmenity" (
  "listingId" TEXT NOT NULL,
  "amenityKey" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HousingListingAmenity_pkey" PRIMARY KEY ("listingId", "amenityKey")
);

CREATE TABLE "HousingSavedListing" (
  "userId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HousingSavedListing_pkey" PRIMARY KEY ("userId", "listingId")
);

CREATE TABLE "HousingInquiry" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "organizationId" TEXT,
  "conversationId" TEXT,
  "status" "HousingInquiryStatus" NOT NULL DEFAULT 'OPEN',
  "topic" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HousingInquiry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HousingInquiry_distinct_users_check"
    CHECK ("requesterUserId" <> "recipientUserId")
);

CREATE TABLE "HousingRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "HousingRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "visibility" "HousingRequestVisibility" NOT NULL DEFAULT 'MEMBERS_ONLY',
  "cityId" TEXT NOT NULL,
  "preferredDistrict" VARCHAR(160),
  "universityId" TEXT,
  "moveInDate" DATE NOT NULL,
  "stayDurationMonths" INTEGER,
  "minimumBudgetMinor" INTEGER,
  "maximumBudgetMinor" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'CNY',
  "preferredListingTypes" "HousingListingType"[],
  "roomPreference" VARCHAR(80),
  "roommateOpen" BOOLEAN NOT NULL DEFAULT false,
  "requiredAmenities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "preferredCommute" VARCHAR(240),
  "description" VARCHAR(1200) NOT NULL,
  "contactPreference" VARCHAR(40) NOT NULL DEFAULT 'KONDO_MESSAGE',
  "publishedAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "matchedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HousingRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HousingRequest_budget_check" CHECK (
    "maximumBudgetMinor" >= 0
    AND ("minimumBudgetMinor" IS NULL OR "minimumBudgetMinor" >= 0)
    AND (
      "minimumBudgetMinor" IS NULL
      OR "minimumBudgetMinor" <= "maximumBudgetMinor"
    )
  )
);

CREATE TABLE "RoommateProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "RoommateProfileStatus" NOT NULL DEFAULT 'INACTIVE',
  "visibility" "RoommateProfileVisibility" NOT NULL DEFAULT 'MEMBERS_ONLY',
  "cityId" TEXT NOT NULL,
  "universityId" TEXT,
  "moveInDate" DATE NOT NULL,
  "stayDurationMonths" INTEGER,
  "budgetMinimumMinor" INTEGER,
  "budgetMaximumMinor" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'CNY',
  "preferredHousingTypes" "HousingListingType"[],
  "currentHousingSituation" VARCHAR(160),
  "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sleepSchedule" VARCHAR(40),
  "routine" VARCHAR(40),
  "cleanlinessPreference" VARCHAR(40),
  "cookingFrequency" VARCHAR(40),
  "smokingPreference" "HousingPolicyPreference" NOT NULL DEFAULT 'NOT_SPECIFIED',
  "petPreference" "HousingPolicyPreference" NOT NULL DEFAULT 'NOT_SPECIFIED',
  "guestPreference" VARCHAR(40),
  "noisePreference" VARCHAR(40),
  "genderPreference" "UserGender",
  "introduction" VARCHAR(800) NOT NULL,
  "allowInterests" BOOLEAN NOT NULL DEFAULT true,
  "showUniversity" BOOLEAN NOT NULL DEFAULT true,
  "showApproximateLocation" BOOLEAN NOT NULL DEFAULT true,
  "activatedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoommateProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RoommateProfile_budget_check" CHECK (
    "budgetMaximumMinor" >= 0
    AND ("budgetMinimumMinor" IS NULL OR "budgetMinimumMinor" >= 0)
    AND (
      "budgetMinimumMinor" IS NULL
      OR "budgetMinimumMinor" <= "budgetMaximumMinor"
    )
  )
);

CREATE TABLE "RoommateInterest" (
  "id" TEXT NOT NULL,
  "senderUserId" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "status" "RoommateInterestStatus" NOT NULL DEFAULT 'SENT',
  "message" VARCHAR(500),
  "conversationId" TEXT,
  "respondedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoommateInterest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RoommateInterest_distinct_users_check"
    CHECK ("senderUserId" <> "recipientUserId")
);

CREATE UNIQUE INDEX "HousingListing_slug_key" ON "HousingListing"("slug");
CREATE INDEX "HousingListing_status_publishedAt_id_idx"
  ON "HousingListing"("status", "publishedAt", "id");
CREATE INDEX "HousingListing_cityId_status_monthlyRentMinor_idx"
  ON "HousingListing"("cityId", "status", "monthlyRentMinor");
CREATE INDEX "HousingListing_universityId_status_availableFrom_idx"
  ON "HousingListing"("universityId", "status", "availableFrom");
CREATE INDEX "HousingListing_type_status_availableFrom_idx"
  ON "HousingListing"("type", "status", "availableFrom");
CREATE INDEX "HousingListing_publisherUserId_status_updatedAt_idx"
  ON "HousingListing"("publisherUserId", "status", "updatedAt");
CREATE INDEX "HousingListing_publisherOrganizationId_status_updatedAt_idx"
  ON "HousingListing"("publisherOrganizationId", "status", "updatedAt");
CREATE INDEX "HousingListing_status_expiresAt_idx"
  ON "HousingListing"("status", "expiresAt");
CREATE INDEX "HousingListing_publicLatitude_publicLongitude_idx"
  ON "HousingListing"("publicLatitude", "publicLongitude");
CREATE INDEX "HousingListing_createdByUserId_createdAt_idx"
  ON "HousingListing"("createdByUserId", "createdAt");
CREATE INDEX "HousingListing_moderatedByUserId_moderatedAt_idx"
  ON "HousingListing"("moderatedByUserId", "moderatedAt");
CREATE INDEX "HousingListing_searchVector_idx"
  ON "HousingListing" USING GIN ("searchVector");
CREATE UNIQUE INDEX "HousingListingMedia_mediaId_key"
  ON "HousingListingMedia"("mediaId");
CREATE UNIQUE INDEX "HousingListingMedia_listingId_sortOrder_key"
  ON "HousingListingMedia"("listingId", "sortOrder");
CREATE UNIQUE INDEX "HousingListingMedia_one_cover_per_listing"
  ON "HousingListingMedia"("listingId") WHERE "isCover" = true;
CREATE INDEX "HousingListingMedia_listingId_kind_sortOrder_idx"
  ON "HousingListingMedia"("listingId", "kind", "sortOrder");
CREATE INDEX "HousingListingAmenity_amenityKey_listingId_idx"
  ON "HousingListingAmenity"("amenityKey", "listingId");
CREATE INDEX "HousingSavedListing_userId_createdAt_idx"
  ON "HousingSavedListing"("userId", "createdAt");
CREATE INDEX "HousingSavedListing_listingId_idx"
  ON "HousingSavedListing"("listingId");
CREATE INDEX "HousingInquiry_listingId_createdAt_idx"
  ON "HousingInquiry"("listingId", "createdAt");
CREATE INDEX "HousingInquiry_requesterUserId_createdAt_idx"
  ON "HousingInquiry"("requesterUserId", "createdAt");
CREATE INDEX "HousingInquiry_recipientUserId_status_createdAt_idx"
  ON "HousingInquiry"("recipientUserId", "status", "createdAt");
CREATE INDEX "HousingInquiry_organizationId_status_createdAt_idx"
  ON "HousingInquiry"("organizationId", "status", "createdAt");
CREATE INDEX "HousingInquiry_conversationId_idx"
  ON "HousingInquiry"("conversationId");
CREATE INDEX "HousingRequest_status_visibility_expiresAt_idx"
  ON "HousingRequest"("status", "visibility", "expiresAt");
CREATE INDEX "HousingRequest_cityId_status_moveInDate_idx"
  ON "HousingRequest"("cityId", "status", "moveInDate");
CREATE INDEX "HousingRequest_universityId_status_moveInDate_idx"
  ON "HousingRequest"("universityId", "status", "moveInDate");
CREATE INDEX "HousingRequest_userId_status_updatedAt_idx"
  ON "HousingRequest"("userId", "status", "updatedAt");
CREATE INDEX "HousingRequest_maximumBudgetMinor_status_idx"
  ON "HousingRequest"("maximumBudgetMinor", "status");
CREATE UNIQUE INDEX "RoommateProfile_userId_key"
  ON "RoommateProfile"("userId");
CREATE INDEX "RoommateProfile_status_visibility_cityId_moveInDate_idx"
  ON "RoommateProfile"("status", "visibility", "cityId", "moveInDate");
CREATE INDEX "RoommateProfile_universityId_status_moveInDate_idx"
  ON "RoommateProfile"("universityId", "status", "moveInDate");
CREATE INDEX "RoommateProfile_budgetMaximumMinor_status_idx"
  ON "RoommateProfile"("budgetMaximumMinor", "status");
CREATE INDEX "RoommateInterest_senderUserId_status_createdAt_idx"
  ON "RoommateInterest"("senderUserId", "status", "createdAt");
CREATE INDEX "RoommateInterest_recipientUserId_status_createdAt_idx"
  ON "RoommateInterest"("recipientUserId", "status", "createdAt");
CREATE INDEX "RoommateInterest_expiresAt_status_idx"
  ON "RoommateInterest"("expiresAt", "status");
CREATE INDEX "RoommateInterest_conversationId_idx"
  ON "RoommateInterest"("conversationId");
CREATE UNIQUE INDEX "RoommateInterest_one_active_pair"
  ON "RoommateInterest"(
    LEAST("senderUserId", "recipientUserId"),
    GREATEST("senderUserId", "recipientUserId")
  )
  WHERE "status" = 'SENT';

ALTER TABLE "HousingListing"
  ADD CONSTRAINT "HousingListing_publisherUserId_fkey"
  FOREIGN KEY ("publisherUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HousingListing"
  ADD CONSTRAINT "HousingListing_publisherOrganizationId_fkey"
  FOREIGN KEY ("publisherOrganizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HousingListing"
  ADD CONSTRAINT "HousingListing_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HousingListing"
  ADD CONSTRAINT "HousingListing_representativeUserId_fkey"
  FOREIGN KEY ("representativeUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HousingListing"
  ADD CONSTRAINT "HousingListing_countryId_fkey"
  FOREIGN KEY ("countryId") REFERENCES "Country"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HousingListing"
  ADD CONSTRAINT "HousingListing_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "City"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HousingListing"
  ADD CONSTRAINT "HousingListing_universityId_fkey"
  FOREIGN KEY ("universityId") REFERENCES "University"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HousingListing"
  ADD CONSTRAINT "HousingListing_moderatedByUserId_fkey"
  FOREIGN KEY ("moderatedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HousingListingMedia"
  ADD CONSTRAINT "HousingListingMedia_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "HousingListing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HousingListingMedia"
  ADD CONSTRAINT "HousingListingMedia_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HousingListingAmenity"
  ADD CONSTRAINT "HousingListingAmenity_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "HousingListing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HousingSavedListing"
  ADD CONSTRAINT "HousingSavedListing_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HousingSavedListing"
  ADD CONSTRAINT "HousingSavedListing_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "HousingListing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HousingInquiry"
  ADD CONSTRAINT "HousingInquiry_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "HousingListing"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HousingInquiry"
  ADD CONSTRAINT "HousingInquiry_requesterUserId_fkey"
  FOREIGN KEY ("requesterUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HousingInquiry"
  ADD CONSTRAINT "HousingInquiry_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HousingInquiry"
  ADD CONSTRAINT "HousingInquiry_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HousingInquiry"
  ADD CONSTRAINT "HousingInquiry_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HousingRequest"
  ADD CONSTRAINT "HousingRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HousingRequest"
  ADD CONSTRAINT "HousingRequest_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "City"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HousingRequest"
  ADD CONSTRAINT "HousingRequest_universityId_fkey"
  FOREIGN KEY ("universityId") REFERENCES "University"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoommateProfile"
  ADD CONSTRAINT "RoommateProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoommateProfile"
  ADD CONSTRAINT "RoommateProfile_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "City"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoommateProfile"
  ADD CONSTRAINT "RoommateProfile_universityId_fkey"
  FOREIGN KEY ("universityId") REFERENCES "University"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoommateInterest"
  ADD CONSTRAINT "RoommateInterest_senderUserId_fkey"
  FOREIGN KEY ("senderUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoommateInterest"
  ADD CONSTRAINT "RoommateInterest_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoommateInterest"
  ADD CONSTRAINT "RoommateInterest_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- City and university relations must remain internally coherent.
CREATE FUNCTION "kondo_validate_housing_location"()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "City"
    WHERE "id" = NEW."cityId" AND "countryId" = NEW."countryId"
  ) THEN
    RAISE EXCEPTION 'Housing city must belong to the selected country.';
  END IF;
  IF NEW."universityId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "University"
    WHERE "id" = NEW."universityId" AND "cityId" = NEW."cityId"
  ) THEN
    RAISE EXCEPTION 'Housing university must belong to the selected city.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "HousingListing_location_guard_trigger"
BEFORE INSERT OR UPDATE OF "countryId", "cityId", "universityId"
ON "HousingListing"
FOR EACH ROW EXECUTE FUNCTION "kondo_validate_housing_location"();

INSERT INTO "NotificationTemplate" (
  "key", "type", "titleTemplate", "bodyTemplate", "isActive", "version",
  "createdAt", "updatedAt"
)
VALUES
  (
    'HOUSING_LISTING_STATUS',
    'HOUSING',
    'Housing listing update',
    '{{listingTitle}}: {{outcome}}.',
    true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'HOUSING_INQUIRY',
    'HOUSING',
    'New housing inquiry',
    '{{actorName}} asked about {{listingTitle}}.',
    true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'HOUSING_REQUEST_MATCH',
    'HOUSING',
    'A housing match may fit',
    'A listing now matches your housing request in {{cityName}}.',
    true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'ROOMMATE_INTEREST',
    'HOUSING',
    'New roommate interest',
    '{{actorName}} would like to connect about housing.',
    true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'ROOMMATE_INTEREST_UPDATE',
    'HOUSING',
    'Roommate interest update',
    '{{actorName}} {{outcome}} your roommate interest.',
    true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT ("key") DO NOTHING;
