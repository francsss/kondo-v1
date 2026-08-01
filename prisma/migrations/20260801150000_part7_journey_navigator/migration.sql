DO $$ BEGIN
  CREATE TYPE "KondoJourneyGroup" AS ENUM (
    'PREPARING_FOR_CHINA',
    'STUDYING_AND_LIVING_IN_CHINA',
    'CAREER_ALUMNI_AND_ENTREPRENEURSHIP'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "KondoJourneyStage" AS ENUM (
    'EXPLORING', 'PREPARING_APPLICATION', 'APPLICATION_SUBMITTED',
    'WAITING_FOR_DECISION', 'ADMITTED', 'PREPARING_ARRIVAL',
    'NEW_ARRIVAL', 'CURRENT_STUDENT', 'INTERNSHIP_PREPARATION', 'FINAL_YEAR',
    'GRADUATING', 'JOB_SEEKING', 'EMPLOYED', 'ALUMNI', 'PROFESSIONAL',
    'ENTREPRENEUR'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NavigatorActionState" AS ENUM ('COMPLETED', 'DISMISSED', 'DEFERRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "UserJourneyDetail"
  ADD COLUMN IF NOT EXISTS "journeyGroup" "KondoJourneyGroup",
  ADD COLUMN IF NOT EXISTS "journeyStage" "KondoJourneyStage",
  ADD COLUMN IF NOT EXISTS "journeyUpdatedAt" TIMESTAMP(3);

UPDATE "UserJourneyDetail" detail
SET
  "journeyGroup" = CASE
    WHEN user_row."studentJourney" IN ('PROSPECTIVE_STUDENT', 'INCOMING_STUDENT', 'ADMITTED_STUDENT')
      THEN 'PREPARING_FOR_CHINA'::"KondoJourneyGroup"
    WHEN user_row."studentJourney" = 'CURRENT_STUDENT'
      THEN 'STUDYING_AND_LIVING_IN_CHINA'::"KondoJourneyGroup"
    WHEN user_row."studentJourney" IN ('ALUMNI', 'PROFESSIONAL')
      THEN 'CAREER_ALUMNI_AND_ENTREPRENEURSHIP'::"KondoJourneyGroup"
    ELSE NULL
  END,
  "journeyStage" = CASE
    WHEN user_row."studentJourney" = 'CURRENT_STUDENT' THEN 'CURRENT_STUDENT'::"KondoJourneyStage"
    WHEN user_row."studentJourney" = 'ALUMNI' THEN 'ALUMNI'::"KondoJourneyStage"
    WHEN user_row."studentJourney" = 'PROFESSIONAL' THEN 'PROFESSIONAL'::"KondoJourneyStage"
    WHEN user_row."studentJourney" = 'ADMITTED_STUDENT' THEN 'ADMITTED'::"KondoJourneyStage"
    WHEN detail."applicationStage" = 'PREPARING_APPLICATION' THEN 'PREPARING_APPLICATION'::"KondoJourneyStage"
    WHEN detail."applicationStage" = 'APPLICATION_SUBMITTED' THEN 'APPLICATION_SUBMITTED'::"KondoJourneyStage"
    WHEN detail."applicationStage" = 'WAITING_FOR_DECISION' THEN 'WAITING_FOR_DECISION'::"KondoJourneyStage"
    WHEN detail."applicationStage" = 'ADMITTED' THEN 'ADMITTED'::"KondoJourneyStage"
    WHEN detail."applicationStage" = 'PREPARING_ARRIVAL' THEN 'PREPARING_ARRIVAL'::"KondoJourneyStage"
    WHEN user_row."studentJourney" IN ('PROSPECTIVE_STUDENT', 'INCOMING_STUDENT') THEN 'EXPLORING'::"KondoJourneyStage"
    ELSE NULL
  END,
  "journeyUpdatedAt" = COALESCE(detail."journeyUpdatedAt", detail."updatedAt")
FROM "User" user_row
WHERE detail."userId" = user_row.id
  AND (detail."journeyGroup" IS NULL OR detail."journeyStage" IS NULL);

CREATE TABLE IF NOT EXISTS "UserNavigatorActionState" (
  "userId" TEXT NOT NULL,
  "actionKey" VARCHAR(100) NOT NULL,
  "state" "NavigatorActionState" NOT NULL,
  "deferredUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserNavigatorActionState_pkey" PRIMARY KEY ("userId", "actionKey"),
  CONSTRAINT "UserNavigatorActionState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserNavigatorActionState_userId_state_deferredUntil_idx"
  ON "UserNavigatorActionState"("userId", "state", "deferredUntil");
