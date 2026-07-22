CREATE TYPE "UserGender" AS ENUM ('MALE', 'FEMALE');
CREATE TYPE "MeetGenderPreference" AS ENUM ('ALL', 'MALE', 'FEMALE');
CREATE TYPE "CallKind" AS ENUM ('MEET', 'VIDEO', 'AUDIO');
CREATE TYPE "CallStatus" AS ENUM ('CONNECTING', 'ACTIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "CallParticipantStatus" AS ENUM ('INVITED', 'JOINED', 'LEFT');

ALTER TABLE "User" ADD COLUMN "gender" "UserGender";

-- Preserve every community while selecting one canonical official national
-- community if historical data contains duplicates.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "countryId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS position
  FROM "Community"
  WHERE "type" = 'COUNTRY' AND "isOfficial" = true AND "countryId" IS NOT NULL
)
UPDATE "Community" AS community
SET "isOfficial" = false
FROM ranked
WHERE community."id" = ranked."id" AND ranked.position > 1;

CREATE UNIQUE INDEX "Community_one_official_country_key"
ON "Community"("countryId")
WHERE "type" = 'COUNTRY' AND "isOfficial" = true AND "countryId" IS NOT NULL;

CREATE TABLE "CallSession" (
  "id" TEXT NOT NULL,
  "roomName" TEXT NOT NULL,
  "kind" "CallKind" NOT NULL,
  "status" "CallStatus" NOT NULL DEFAULT 'CONNECTING',
  "conversationId" TEXT,
  "createdById" TEXT NOT NULL,
  "connectedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetQueueEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "genderPreference" "MeetGenderPreference" NOT NULL DEFAULT 'ALL',
  "countryPreferenceId" TEXT,
  "callSessionId" TEXT,
  "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetQueueEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CallParticipant" (
  "callSessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "CallParticipantStatus" NOT NULL DEFAULT 'INVITED',
  "joinedAt" TIMESTAMP(3),
  "leftAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CallParticipant_pkey" PRIMARY KEY ("callSessionId", "userId")
);

CREATE UNIQUE INDEX "CallSession_roomName_key" ON "CallSession"("roomName");
CREATE INDEX "CallSession_status_expiresAt_idx" ON "CallSession"("status", "expiresAt");
CREATE INDEX "CallSession_conversationId_status_createdAt_idx" ON "CallSession"("conversationId", "status", "createdAt");
CREATE UNIQUE INDEX "MeetQueueEntry_userId_key" ON "MeetQueueEntry"("userId");
CREATE INDEX "MeetQueueEntry_callSessionId_createdAt_idx" ON "MeetQueueEntry"("callSessionId", "createdAt");
CREATE INDEX "MeetQueueEntry_heartbeatAt_idx" ON "MeetQueueEntry"("heartbeatAt");
CREATE INDEX "MeetQueueEntry_countryPreferenceId_idx" ON "MeetQueueEntry"("countryPreferenceId");
CREATE INDEX "CallParticipant_userId_status_createdAt_idx" ON "CallParticipant"("userId", "status", "createdAt");

ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeetQueueEntry" ADD CONSTRAINT "MeetQueueEntry_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetQueueEntry" ADD CONSTRAINT "MeetQueueEntry_countryPreferenceId_fkey"
FOREIGN KEY ("countryPreferenceId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetQueueEntry" ADD CONSTRAINT "MeetQueueEntry_callSessionId_fkey"
FOREIGN KEY ("callSessionId") REFERENCES "CallSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CallParticipant" ADD CONSTRAINT "CallParticipant_callSessionId_fkey"
FOREIGN KEY ("callSessionId") REFERENCES "CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CallParticipant" ADD CONSTRAINT "CallParticipant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
