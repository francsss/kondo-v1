DO $$ BEGIN
  CREATE TYPE "OpportunityInterviewFormat" AS ENUM ('VIDEO', 'PHONE', 'IN_PERSON', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OpportunityInterviewStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "OpportunityInterview" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "format" "OpportunityInterviewFormat" NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "timezone" VARCHAR(64) NOT NULL,
  "locationLabel" VARCHAR(240),
  "meetingUrl" VARCHAR(500),
  "preparationNote" VARCHAR(2000),
  "status" "OpportunityInterviewStatus" NOT NULL DEFAULT 'PROPOSED',
  "createdByUserId" TEXT NOT NULL,
  "applicantRespondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpportunityInterview_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "OpportunityInterview"
    ADD CONSTRAINT "OpportunityInterview_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "OpportunityApplication"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OpportunityInterview"
    ADD CONSTRAINT "OpportunityInterview_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "OpportunityInterview_applicationId_scheduledAt_idx"
  ON "OpportunityInterview"("applicationId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "OpportunityInterview_createdByUserId_createdAt_idx"
  ON "OpportunityInterview"("createdByUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "OpportunityInterview_status_scheduledAt_idx"
  ON "OpportunityInterview"("status", "scheduledAt");

INSERT INTO "NotificationTemplate" (
  "key", "type", "titleTemplate", "bodyTemplate", "isActive", "version", "createdAt", "updatedAt"
) VALUES
  ('OPPORTUNITY_PUBLISHED', 'OPPORTUNITY', 'Opportunity published', '{{opportunityTitle}} is now live on Kondo.', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('OPPORTUNITY_DEADLINE_REMINDER', 'OPPORTUNITY', 'Application deadline approaching', '{{opportunityTitle}} closes in {{days}} day(s).', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('OPPORTUNITY_APPLICATION_SUBMITTED', 'OPPORTUNITY', 'Application submitted', 'Your application for {{opportunityTitle}} was submitted successfully.', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('OPPORTUNITY_NEW_APPLICATION', 'OPPORTUNITY', 'New application received', 'A new application was submitted for {{opportunityTitle}}.', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('OPPORTUNITY_APPLICATION_STATUS', 'OPPORTUNITY', 'Application update', 'Your application for {{opportunityTitle}} is now {{status}}.', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('OPPORTUNITY_INTERVIEW_INVITATION', 'OPPORTUNITY', 'Interview invitation', 'You received an interview invitation for {{opportunityTitle}}.', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('OPPORTUNITY_APPLICANT_RESPONSE', 'OPPORTUNITY', 'Applicant response received', 'An applicant responded for {{opportunityTitle}}.', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('OPPORTUNITY_MODERATION_RESULT', 'OPPORTUNITY', 'Opportunity review update', '{{opportunityTitle}}: {{outcome}}.', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
