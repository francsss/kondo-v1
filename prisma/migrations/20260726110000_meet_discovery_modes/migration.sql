CREATE TYPE "MeetMode" AS ENUM ('RANDOM', 'NEARBY', 'LOOKING_FOR');

ALTER TABLE "User"
  ADD COLUMN "nearbyDiscoveryEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "meetIntents" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "MeetQueueEntry"
  ADD COLUMN "mode" "MeetMode" NOT NULL DEFAULT 'RANDOM',
  ADD COLUMN "intents" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "MeetQueueEntry_mode_heartbeatAt_idx"
  ON "MeetQueueEntry"("mode", "heartbeatAt");
