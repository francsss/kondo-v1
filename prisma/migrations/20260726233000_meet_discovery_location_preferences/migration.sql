ALTER TABLE "MeetDiscoveryProfile"
ADD COLUMN "discoveryCityId" TEXT,
ADD COLUMN "discoveryUniversityId" TEXT;

UPDATE "MeetDiscoveryProfile" AS profile
SET
  "discoveryCityId" = users."cityId",
  "discoveryUniversityId" = users."universityId"
FROM "User" AS users
WHERE users."id" = profile."userId";

CREATE INDEX "MeetDiscoveryProfile_discoveryCityId_discoveryUniversityId_nearbyVisibility_idx"
ON "MeetDiscoveryProfile"(
  "discoveryCityId",
  "discoveryUniversityId",
  "nearbyVisibility"
);

ALTER TABLE "MeetDiscoveryProfile"
ADD CONSTRAINT "MeetDiscoveryProfile_discoveryCityId_fkey"
FOREIGN KEY ("discoveryCityId") REFERENCES "City"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MeetDiscoveryProfile"
ADD CONSTRAINT "MeetDiscoveryProfile_discoveryUniversityId_fkey"
FOREIGN KEY ("discoveryUniversityId") REFERENCES "University"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
