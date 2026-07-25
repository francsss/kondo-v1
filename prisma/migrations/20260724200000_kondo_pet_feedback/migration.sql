-- Temporary MVP feedback collection for the Kondo Pet.

CREATE TYPE "PetFeedbackCategory" AS ENUM (
  'BUG',
  'SUGGESTION',
  'IDEA',
  'EXPERIENCE',
  'OTHER'
);

CREATE TYPE "PetFeedbackStatus" AS ENUM (
  'NEW',
  'IN_PROGRESS',
  'RESOLVED'
);

CREATE TABLE "PetFeedback" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "category" "PetFeedbackCategory" NOT NULL,
  "message" VARCHAR(2000) NOT NULL,
  "pagePath" VARCHAR(240) NOT NULL,
  "pageArea" VARCHAR(40) NOT NULL,
  "submittedAfterMs" INTEGER,
  "status" "PetFeedbackStatus" NOT NULL DEFAULT 'NEW',
  "version" INTEGER NOT NULL DEFAULT 1,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PetFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PetFeedbackNote" (
  "id" TEXT NOT NULL,
  "feedbackId" TEXT NOT NULL,
  "authorId" TEXT,
  "body" VARCHAR(2000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PetFeedbackNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PetFeedback_status_createdAt_idx"
  ON "PetFeedback"("status", "createdAt");
CREATE INDEX "PetFeedback_category_createdAt_idx"
  ON "PetFeedback"("category", "createdAt");
CREATE INDEX "PetFeedback_pageArea_createdAt_idx"
  ON "PetFeedback"("pageArea", "createdAt");
CREATE INDEX "PetFeedback_userId_createdAt_idx"
  ON "PetFeedback"("userId", "createdAt");
CREATE INDEX "PetFeedbackNote_feedbackId_createdAt_idx"
  ON "PetFeedbackNote"("feedbackId", "createdAt");
CREATE INDEX "PetFeedbackNote_authorId_createdAt_idx"
  ON "PetFeedbackNote"("authorId", "createdAt");

ALTER TABLE "PetFeedback"
  ADD CONSTRAINT "PetFeedback_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PetFeedback"
  ADD CONSTRAINT "PetFeedback_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PetFeedbackNote"
  ADD CONSTRAINT "PetFeedbackNote_feedbackId_fkey"
  FOREIGN KEY ("feedbackId") REFERENCES "PetFeedback"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PetFeedbackNote"
  ADD CONSTRAINT "PetFeedbackNote_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
