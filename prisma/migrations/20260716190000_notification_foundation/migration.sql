CREATE TYPE "NotificationJobStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'SKIPPED',
    'FAILED'
);

CREATE TYPE "NotificationAnnouncementStatus" AS ENUM (
    'QUEUED',
    'COMPLETED',
    'CANCELLED'
);

ALTER TABLE "Notification"
ADD COLUMN "templateKey" VARCHAR(80),
ADD COLUMN "dedupeKey" VARCHAR(160),
ADD COLUMN "data" JSONB,
ADD COLUMN "jobId" TEXT,
ADD COLUMN "hiddenAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Notification_jobId_key" ON "Notification"("jobId");
CREATE UNIQUE INDEX "Notification_recipientId_dedupeKey_key"
ON "Notification"("recipientId", "dedupeKey");
CREATE INDEX "Notification_recipientId_hiddenAt_createdAt_idx"
ON "Notification"("recipientId", "hiddenAt", "createdAt");

CREATE TABLE "NotificationTemplate" (
    "key" VARCHAR(80) NOT NULL,
    "type" "NotificationType" NOT NULL,
    "titleTemplate" VARCHAR(160) NOT NULL,
    "bodyTemplate" VARCHAR(280),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "NotificationTemplate_type_isActive_idx"
ON "NotificationTemplate"("type", "isActive");

CREATE TABLE "NotificationAnnouncement" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" VARCHAR(280) NOT NULL,
    "href" TEXT,
    "status" "NotificationAnnouncementStatus" NOT NULL DEFAULT 'QUEUED',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationAnnouncement_status_queuedAt_idx"
ON "NotificationAnnouncement"("status", "queuedAt");
CREATE INDEX "NotificationAnnouncement_createdById_createdAt_idx"
ON "NotificationAnnouncement"("createdById", "createdAt");

CREATE TABLE "NotificationJob" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "NotificationType" NOT NULL,
    "templateKey" VARCHAR(80) NOT NULL,
    "data" JSONB,
    "href" TEXT,
    "dedupeKey" VARCHAR(160) NOT NULL,
    "status" "NotificationJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastErrorCode" VARCHAR(80),
    "announcementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationJob_recipientId_dedupeKey_key"
ON "NotificationJob"("recipientId", "dedupeKey");
CREATE INDEX "NotificationJob_status_availableAt_createdAt_idx"
ON "NotificationJob"("status", "availableAt", "createdAt");
CREATE INDEX "NotificationJob_recipientId_status_createdAt_idx"
ON "NotificationJob"("recipientId", "status", "createdAt");
CREATE INDEX "NotificationJob_announcementId_status_idx"
ON "NotificationJob"("announcementId", "status");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "NotificationJob"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationTemplate"
ADD CONSTRAINT "NotificationTemplate_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationAnnouncement"
ADD CONSTRAINT "NotificationAnnouncement_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationJob"
ADD CONSTRAINT "NotificationJob_recipientId_fkey"
FOREIGN KEY ("recipientId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationJob"
ADD CONSTRAINT "NotificationJob_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationJob"
ADD CONSTRAINT "NotificationJob_templateKey_fkey"
FOREIGN KEY ("templateKey") REFERENCES "NotificationTemplate"("key")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NotificationJob"
ADD CONSTRAINT "NotificationJob_announcementId_fkey"
FOREIGN KEY ("announcementId") REFERENCES "NotificationAnnouncement"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "NotificationTemplate"
("key", "type", "titleTemplate", "bodyTemplate", "isActive", "version", "updatedAt")
VALUES
('MESSAGE_NEW', 'MESSAGE', 'New message from {{actorName}}', '{{preview}}', true, 1, CURRENT_TIMESTAMP),
('POST_COMMENT', 'COMMENT', 'New comment from {{actorName}}', '{{preview}}', true, 1, CURRENT_TIMESTAMP),
('QNA_REPLY', 'REPLY', 'New answer from {{actorName}}', '{{preview}}', true, 1, CURRENT_TIMESTAMP),
('MARKETPLACE_CONTACT', 'MARKETPLACE_UPDATE', 'New marketplace message', '{{actorName}} contacted you about {{listingTitle}}.', true, 1, CURRENT_TIMESTAMP),
('MODERATION_RESULT', 'MODERATION_UPDATE', 'Your report was reviewed', '{{outcome}}', true, 1, CURRENT_TIMESTAMP),
('ADMIN_ANNOUNCEMENT', 'COMMUNITY_ANNOUNCEMENT', '{{title}}', '{{body}}', true, 1, CURRENT_TIMESTAMP);
