-- Student Stories and the Kondo Official Profile trust workflow.

ALTER TYPE "MediaKind" ADD VALUE 'VIDEO';
ALTER TYPE "MediaPurpose" ADD VALUE 'STORY_VIDEO';
ALTER TYPE "MediaPurpose" ADD VALUE 'STORY_POSTER';
ALTER TYPE "MediaPurpose" ADD VALUE 'VERIFICATION_DOCUMENT';

CREATE TYPE "StoryStatus" AS ENUM (
  'DRAFT',
  'UPLOADING',
  'SUBMITTED',
  'PENDING_REVIEW',
  'CHANGES_REQUESTED',
  'RESUBMITTED',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'REJECTED',
  'REMOVED',
  'ARCHIVED'
);

CREATE TYPE "StoryCreatorStatus" AS ENUM (
  'STANDARD',
  'AMBASSADOR',
  'APPROVED_CREATOR',
  'TRUSTED_CREATOR',
  'SUSPENDED'
);

CREATE TYPE "StoryEntityType" AS ENUM (
  'CITY',
  'UNIVERSITY',
  'COMMUNITY',
  'COMPANY',
  'INTERNSHIP',
  'EVENT'
);

CREATE TYPE "OfficialProfileStatus" AS ENUM (
  'NOT_VERIFIED',
  'STARTED',
  'SUBMITTED',
  'MORE_INFO_REQUIRED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'REVOKED',
  'REVIEW_REQUIRED'
);

CREATE TYPE "OfficialOrganizationType" AS ENUM (
  'KONDO',
  'KONDO_TEAM',
  'UNIVERSITY',
  'STUDENT_ASSOCIATION',
  'COMMUNITY',
  'COMPANY',
  'EVENT_ORGANIZER',
  'INSTITUTION',
  'OTHER'
);

ALTER TABLE "User"
  ADD COLUMN "storyCreatorStatus" "StoryCreatorStatus" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "officialProfileStatus" "OfficialProfileStatus" NOT NULL DEFAULT 'NOT_VERIFIED',
  ADD COLUMN "officialOrganizationType" "OfficialOrganizationType",
  ADD COLUMN "officialOrganizationName" VARCHAR(160),
  ADD COLUMN "officialVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "officialReviewDueAt" TIMESTAMP(3);

ALTER TABLE "MediaAsset"
  ADD COLUMN "durationSeconds" INTEGER;

CREATE TABLE "StoryCategory" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "description" VARCHAR(280),
  "icon" VARCHAR(16),
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoryCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Story" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "videoMediaId" TEXT NOT NULL,
  "posterMediaId" TEXT,
  "status" "StoryStatus" NOT NULL DEFAULT 'DRAFT',
  "title" VARCHAR(120) NOT NULL,
  "description" VARCHAR(700) NOT NULL,
  "language" VARCHAR(16) NOT NULL DEFAULT 'en',
  "durationSeconds" INTEGER NOT NULL,
  "captions" TEXT,
  "commentsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "isInstitutional" BOOLEAN NOT NULL DEFAULT false,
  "isSponsored" BOOLEAN NOT NULL DEFAULT false,
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "scheduledAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "moderatedAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "moderationReason" VARCHAR(1000),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryEntityLink" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "type" "StoryEntityType" NOT NULL,
  "cityId" TEXT,
  "universityId" TEXT,
  "communityId" TEXT,
  "externalEntityId" VARCHAR(160),
  "externalLabel" VARCHAR(160),
  "externalHref" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryEntityLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryComment" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "parentId" TEXT,
  "content" VARCHAR(1200) NOT NULL,
  "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
  "editedAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoryComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryLike" (
  "storyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryLike_pkey" PRIMARY KEY ("storyId", "userId")
);

CREATE TABLE "StorySave" (
  "storyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorySave_pkey" PRIMARY KEY ("storyId", "userId")
);

CREATE TABLE "StoryHide" (
  "storyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reason" VARCHAR(160),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryHide_pkey" PRIMARY KEY ("storyId", "userId")
);

CREATE TABLE "StoryModerationEvent" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "actorId" TEXT,
  "fromStatus" "StoryStatus",
  "toStatus" "StoryStatus" NOT NULL,
  "reason" VARCHAR(1000),
  "internalNote" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryModerationEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfficialVerificationRequest" (
  "id" TEXT NOT NULL,
  "applicantId" TEXT NOT NULL,
  "status" "OfficialProfileStatus" NOT NULL DEFAULT 'STARTED',
  "organizationType" "OfficialOrganizationType" NOT NULL,
  "organizationName" VARCHAR(160) NOT NULL,
  "authorityDescription" VARCHAR(1000) NOT NULL,
  "officialWebsite" VARCHAR(500),
  "reviewerId" TEXT,
  "decisionReason" VARCHAR(1200),
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "nextReviewAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfficialVerificationRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfficialVerificationDocument" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfficialVerificationDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoryCategory_slug_key" ON "StoryCategory"("slug");
CREATE UNIQUE INDEX "StoryCategory_name_key" ON "StoryCategory"("name");
CREATE INDEX "StoryCategory_isActive_order_name_idx" ON "StoryCategory"("isActive", "order", "name");

CREATE UNIQUE INDEX "Story_slug_key" ON "Story"("slug");
CREATE UNIQUE INDEX "Story_videoMediaId_key" ON "Story"("videoMediaId");
CREATE UNIQUE INDEX "Story_posterMediaId_key" ON "Story"("posterMediaId");
CREATE INDEX "Story_status_publishedAt_idx" ON "Story"("status", "publishedAt");
CREATE INDEX "Story_categoryId_status_publishedAt_idx" ON "Story"("categoryId", "status", "publishedAt");
CREATE INDEX "Story_creatorId_status_createdAt_idx" ON "Story"("creatorId", "status", "createdAt");
CREATE INDEX "Story_isFeatured_status_publishedAt_idx" ON "Story"("isFeatured", "status", "publishedAt");
CREATE INDEX "Story_scheduledAt_status_idx" ON "Story"("scheduledAt", "status");

CREATE UNIQUE INDEX "StoryEntityLink_storyId_type_cityId_universityId_communityId_externalEntityId_key"
  ON "StoryEntityLink"("storyId", "type", "cityId", "universityId", "communityId", "externalEntityId");
CREATE INDEX "StoryEntityLink_type_externalEntityId_idx" ON "StoryEntityLink"("type", "externalEntityId");
CREATE INDEX "StoryEntityLink_cityId_storyId_idx" ON "StoryEntityLink"("cityId", "storyId");
CREATE INDEX "StoryEntityLink_universityId_storyId_idx" ON "StoryEntityLink"("universityId", "storyId");
CREATE INDEX "StoryEntityLink_communityId_storyId_idx" ON "StoryEntityLink"("communityId", "storyId");

CREATE INDEX "StoryComment_storyId_status_createdAt_idx" ON "StoryComment"("storyId", "status", "createdAt");
CREATE INDEX "StoryComment_authorId_createdAt_idx" ON "StoryComment"("authorId", "createdAt");
CREATE INDEX "StoryComment_parentId_idx" ON "StoryComment"("parentId");
CREATE INDEX "StoryLike_userId_createdAt_idx" ON "StoryLike"("userId", "createdAt");
CREATE INDEX "StorySave_userId_createdAt_idx" ON "StorySave"("userId", "createdAt");
CREATE INDEX "StoryHide_userId_createdAt_idx" ON "StoryHide"("userId", "createdAt");
CREATE INDEX "StoryModerationEvent_storyId_createdAt_idx" ON "StoryModerationEvent"("storyId", "createdAt");
CREATE INDEX "StoryModerationEvent_actorId_createdAt_idx" ON "StoryModerationEvent"("actorId", "createdAt");
CREATE INDEX "StoryModerationEvent_toStatus_createdAt_idx" ON "StoryModerationEvent"("toStatus", "createdAt");

CREATE INDEX "OfficialVerificationRequest_applicantId_createdAt_idx"
  ON "OfficialVerificationRequest"("applicantId", "createdAt");
CREATE INDEX "OfficialVerificationRequest_status_submittedAt_idx"
  ON "OfficialVerificationRequest"("status", "submittedAt");
CREATE INDEX "OfficialVerificationRequest_reviewerId_status_updatedAt_idx"
  ON "OfficialVerificationRequest"("reviewerId", "status", "updatedAt");
CREATE UNIQUE INDEX "OfficialVerificationDocument_mediaId_key"
  ON "OfficialVerificationDocument"("mediaId");
CREATE INDEX "OfficialVerificationDocument_requestId_createdAt_idx"
  ON "OfficialVerificationDocument"("requestId", "createdAt");

ALTER TABLE "Story"
  ADD CONSTRAINT "Story_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Story_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StoryCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Story_videoMediaId_fkey" FOREIGN KEY ("videoMediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Story_posterMediaId_fkey" FOREIGN KEY ("posterMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StoryEntityLink"
  ADD CONSTRAINT "StoryEntityLink_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StoryEntityLink_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StoryEntityLink_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StoryEntityLink_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryComment"
  ADD CONSTRAINT "StoryComment_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StoryComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StoryComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StoryComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryLike"
  ADD CONSTRAINT "StoryLike_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StoryLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StorySave"
  ADD CONSTRAINT "StorySave_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StorySave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryHide"
  ADD CONSTRAINT "StoryHide_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StoryHide_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryModerationEvent"
  ADD CONSTRAINT "StoryModerationEvent_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StoryModerationEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OfficialVerificationRequest"
  ADD CONSTRAINT "OfficialVerificationRequest_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "OfficialVerificationRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OfficialVerificationDocument"
  ADD CONSTRAINT "OfficialVerificationDocument_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "OfficialVerificationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "OfficialVerificationDocument_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "StoryCategory" ("id", "slug", "name", "description", "icon", "order", "isActive", "updatedAt")
VALUES
  ('story_category_student_life', 'student-life', 'Student life', 'Daily student life and practical experiences in China.', '🎓', 10, true, CURRENT_TIMESTAMP),
  ('story_category_cities', 'cities', 'Cities', 'Useful ways to understand and navigate Chinese cities.', '📍', 20, true, CURRENT_TIMESTAMP),
  ('story_category_universities', 'universities', 'Universities', 'Campuses, programs and academic life.', '🏫', 30, true, CURRENT_TIMESTAMP),
  ('story_category_practical', 'practical-advice', 'Practical advice', 'Clear, actionable guidance for everyday life.', '🧭', 40, true, CURRENT_TIMESTAMP),
  ('story_category_opportunities', 'opportunities', 'Opportunities', 'Internships, events, scholarships and useful openings.', '🌱', 50, true, CURRENT_TIMESTAMP),
  ('story_category_community', 'community', 'Community', 'Stories that help students meet and support one another.', '🤝', 60, true, CURRENT_TIMESTAMP);
