WITH "eligibleUsers" AS (
  SELECT
    users."id",
    users."gender",
    users."cityId",
    users."universityId",
    users."languages"
  FROM "User" AS users
  INNER JOIN "City" AS cities
    ON cities."id" = users."cityId"
    AND cities."isActive" = true
  INNER JOIN "University" AS universities
    ON universities."id" = users."universityId"
    AND universities."cityId" = users."cityId"
    AND universities."isActive" = true
    AND universities."verified" = true
  WHERE users."status" = 'ACTIVE'
    AND users."onboardingCompletedAt" IS NOT NULL
    AND users."gender" IS NOT NULL
    AND users."profileAudience" IN ('PUBLIC', 'MEMBERS')
),
"insertedProfiles" AS (
  INSERT INTO "MeetDiscoveryProfile" (
    "userId",
    "gender",
    "interestedIn",
    "birthYear",
    "minimumAge",
    "maximumAge",
    "preferredLanguages",
    "lookingFor",
    "discoveryCityId",
    "discoveryUniversityId",
    "distanceRange",
    "otherCityId",
    "nearbyVisibility",
    "showAge",
    "showNationality",
    "showUniversity",
    "showRelationshipStatus",
    "showLanguages",
    "showInterests",
    "completedAt",
    "createdAt",
    "updatedAt"
  )
  SELECT
    eligible."id",
    eligible."gender",
    'ALL'::"MeetGenderPreference",
    NULL,
    18,
    40,
    eligible."languages",
    ARRAY[
      'FRIENDS',
      'STUDY',
      'LANGUAGE',
      'SPORTS',
      'CITY',
      'NETWORKING',
      'COUNTRY',
      'RELATIONSHIP'
    ]::TEXT[],
    eligible."cityId",
    eligible."universityId",
    'CITY'::"MeetDistanceRange",
    NULL,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM "eligibleUsers" AS eligible
  ON CONFLICT ("userId") DO NOTHING
  RETURNING "userId"
)
UPDATE "User"
SET
  "nearbyDiscoveryEnabled" = true,
  "meetIntents" = ARRAY[
    'FRIENDS',
    'STUDY',
    'LANGUAGE',
    'SPORTS',
    'CITY',
    'NETWORKING',
    'COUNTRY',
    'RELATIONSHIP'
  ]::TEXT[]
WHERE "id" IN (SELECT "userId" FROM "insertedProfiles");
