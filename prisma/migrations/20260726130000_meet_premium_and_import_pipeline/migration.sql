-- Timetable processing diagnostics remain additive and private to the owner.
ALTER TABLE "ScheduleImport"
ADD COLUMN "processingStage" VARCHAR(48),
ADD COLUMN "processingDiagnostics" JSONB;

ALTER TABLE "ScheduleImportResult"
ADD COLUMN "diagnostics" JSONB;

ALTER TABLE "User"
ALTER COLUMN "nearbyDiscoveryEnabled" SET DEFAULT true;

CREATE TYPE "MeetDistanceRange" AS ENUM (
  'KM_5',
  'KM_10',
  'KM_20',
  'CITY',
  'OTHER_CITY'
);

CREATE TYPE "SubscriptionStatus" AS ENUM (
  'PENDING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELLED',
  'EXPIRED'
);

CREATE TYPE "BillingProvider" AS ENUM ('ALIPAY');

CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

CREATE TABLE "MeetDiscoveryProfile" (
  "userId" TEXT NOT NULL,
  "gender" "UserGender" NOT NULL,
  "interestedIn" "MeetGenderPreference" NOT NULL DEFAULT 'ALL',
  "birthYear" INTEGER,
  "minimumAge" INTEGER NOT NULL DEFAULT 18,
  "maximumAge" INTEGER NOT NULL DEFAULT 40,
  "preferredLanguages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "lookingFor" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "distanceRange" "MeetDistanceRange" NOT NULL DEFAULT 'CITY',
  "otherCityId" TEXT,
  "nearbyVisibility" BOOLEAN NOT NULL DEFAULT true,
  "showAge" BOOLEAN NOT NULL DEFAULT true,
  "showNationality" BOOLEAN NOT NULL DEFAULT true,
  "showUniversity" BOOLEAN NOT NULL DEFAULT true,
  "showRelationshipStatus" BOOLEAN NOT NULL DEFAULT true,
  "showLanguages" BOOLEAN NOT NULL DEFAULT true,
  "showInterests" BOOLEAN NOT NULL DEFAULT true,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetDiscoveryProfile_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "MeetDiscoveryProfile_gender_nearbyVisibility_completedAt_idx"
ON "MeetDiscoveryProfile"("gender", "nearbyVisibility", "completedAt");

CREATE INDEX "MeetDiscoveryProfile_distanceRange_otherCityId_idx"
ON "MeetDiscoveryProfile"("distanceRange", "otherCityId");

ALTER TABLE "MeetDiscoveryProfile"
ADD CONSTRAINT "MeetDiscoveryProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SubscriptionPlan" (
  "id" TEXT NOT NULL,
  "key" VARCHAR(80) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "priceMinor" INTEGER,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'CNY',
  "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
  "featureKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionPlan_key_key" ON "SubscriptionPlan"("key");
CREATE INDEX "SubscriptionPlan_active_displayOrder_idx"
ON "SubscriptionPlan"("active", "displayOrder");

CREATE TABLE "UserSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
  "billingProvider" "BillingProvider",
  "providerCustomerRef" VARCHAR(191),
  "providerSubscriptionRef" VARCHAR(191),
  "currentPeriodStartsAt" TIMESTAMP(3),
  "currentPeriodEndsAt" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "cancelledAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserSubscription_providerSubscriptionRef_key"
ON "UserSubscription"("providerSubscriptionRef");

CREATE INDEX "UserSubscription_userId_status_currentPeriodEndsAt_idx"
ON "UserSubscription"("userId", "status", "currentPeriodEndsAt");

CREATE INDEX "UserSubscription_planId_status_idx"
ON "UserSubscription"("planId", "status");

ALTER TABLE "UserSubscription"
ADD CONSTRAINT "UserSubscription_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserSubscription"
ADD CONSTRAINT "UserSubscription_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "SubscriptionPlan" (
  "id",
  "key",
  "name",
  "description",
  "active",
  "currency",
  "billingInterval",
  "featureKeys",
  "displayOrder",
  "updatedAt"
)
VALUES (
  'plan_meet_premium',
  'meet-premium',
  'Meet Premium',
  'Advanced privacy-first student discovery features.',
  true,
  'CNY',
  'MONTHLY',
  ARRAY[
    'MEET_FULL_PROFILES',
    'MEET_MAP_CONNECTIONS',
    'MEET_EXTENDED_DISTANCE',
    'MEET_OTHER_CITY',
    'MEET_ADVANCED_FILTERS'
  ]::TEXT[],
  10,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
