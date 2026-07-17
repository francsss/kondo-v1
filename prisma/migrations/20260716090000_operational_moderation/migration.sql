-- CreateEnum
CREATE TYPE "ReportDecision" AS ENUM (
    'VIOLATION_CONFIRMED',
    'NO_VIOLATION',
    'INSUFFICIENT_EVIDENCE',
    'DUPLICATE',
    'OUT_OF_SCOPE',
    'ESCALATED',
    'OTHER'
);

-- CreateEnum
CREATE TYPE "ReportEvidenceKind" AS ENUM ('CONVERSATION_SNAPSHOT');

-- Preserve reports when a reporter account is removed.
ALTER TABLE "Report" DROP CONSTRAINT "Report_reporterId_fkey";
ALTER TABLE "Report" ALTER COLUMN "reporterId" DROP NOT NULL;
ALTER TABLE "Report"
ADD CONSTRAINT "Report_reporterId_fkey"
FOREIGN KEY ("reporterId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Extend report lifecycle and operational ownership.
ALTER TABLE "Report"
ADD COLUMN "subjectUserId" TEXT,
ADD COLUMN "assignedById" TEXT,
ADD COLUMN "assignedAt" TIMESTAMP(3),
ADD COLUMN "decision" "ReportDecision",
ALTER COLUMN "resolution" TYPE VARCHAR(2000),
ADD COLUMN "resolvedById" TEXT,
ADD COLUMN "reopenedAt" TIMESTAMP(3),
ADD COLUMN "reopenedById" TEXT,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ReportNote" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportEvidence" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "kind" "ReportEvidenceKind" NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "sensitive" BOOLEAN NOT NULL DEFAULT true,
    "capturedById" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportEvidence_pkey" PRIMARY KEY ("id")
);

-- Replace the older queue index with the operational query shape.
DROP INDEX "Report_status_createdAt_idx";
DROP INDEX "Report_assigneeId_idx";

-- CreateIndex
CREATE INDEX "Report_status_updatedAt_idx" ON "Report"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Report_reporterId_createdAt_idx" ON "Report"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_subjectUserId_status_idx" ON "Report"("subjectUserId", "status");

-- CreateIndex
CREATE INDEX "Report_assigneeId_status_updatedAt_idx" ON "Report"("assigneeId", "status", "updatedAt");

-- Preserve duplicate historical reports while closing extra active conversation
-- cases before adding the concurrency guard.
WITH ranked_active_conversation_reports AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "reporterId", "targetId"
            ORDER BY "createdAt" ASC, "id" ASC
        ) AS row_number
    FROM "Report"
    WHERE
        "reporterId" IS NOT NULL
        AND "targetType" = 'Conversation'
        AND "status" IN ('OPEN', 'REVIEWING')
)
UPDATE "Report"
SET
    "status" = 'DISMISSED',
    "decision" = 'DUPLICATE',
    "resolution" = 'Duplicate active conversation report closed during the Module 3 migration.',
    "resolvedAt" = "updatedAt",
    "version" = "version" + 1
WHERE "id" IN (
    SELECT "id"
    FROM ranked_active_conversation_reports
    WHERE row_number > 1
);

-- Backfill any legacy terminal report before enforcing lifecycle coherence.
UPDATE "Report"
SET
    "decision" = COALESCE("decision", 'OTHER'::"ReportDecision"),
    "resolution" = COALESCE(
        "resolution",
        'Legacy moderation decision preserved during the Module 3 migration.'
    ),
    "resolvedAt" = COALESCE("resolvedAt", "updatedAt")
WHERE "status" IN ('RESOLVED', 'DISMISSED');

-- Preserve any legacy resolution text attached to a still-active report as an
-- internal note, then normalize active reports before enforcing the lifecycle.
INSERT INTO "ReportNote" (
    "id",
    "reportId",
    "authorId",
    "body",
    "createdAt"
)
SELECT
    'legacy-active-resolution-' || "id",
    "id",
    NULL,
    LEFT(
        'Legacy active resolution preserved during the Module 3 migration: ' || "resolution",
        2000
    ),
    "updatedAt"
FROM "Report"
WHERE
    "status" IN ('OPEN', 'REVIEWING')
    AND "resolution" IS NOT NULL;

UPDATE "Report"
SET
    "decision" = NULL,
    "resolution" = NULL,
    "resolvedAt" = NULL,
    "resolvedById" = NULL
WHERE "status" IN ('OPEN', 'REVIEWING');

-- Prevent concurrent duplicate active conversation reports from the same reporter.
CREATE UNIQUE INDEX "Report_active_reporter_target_key"
ON "Report"("reporterId", "targetType", "targetId")
WHERE
    "reporterId" IS NOT NULL
    AND "targetType" = 'Conversation'
    AND "status" IN ('OPEN', 'REVIEWING');

-- CreateIndex
CREATE INDEX "ReportNote_reportId_createdAt_idx" ON "ReportNote"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportNote_authorId_createdAt_idx" ON "ReportNote"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportEvidence_reportId_capturedAt_idx" ON "ReportEvidence"("reportId", "capturedAt");

-- CreateIndex
CREATE INDEX "ReportEvidence_capturedById_capturedAt_idx" ON "ReportEvidence"("capturedById", "capturedAt");

-- AddForeignKey
ALTER TABLE "Report"
ADD CONSTRAINT "Report_subjectUserId_fkey"
FOREIGN KEY ("subjectUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report"
ADD CONSTRAINT "Report_assignedById_fkey"
FOREIGN KEY ("assignedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report"
ADD CONSTRAINT "Report_resolvedById_fkey"
FOREIGN KEY ("resolvedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report"
ADD CONSTRAINT "Report_reopenedById_fkey"
FOREIGN KEY ("reopenedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportNote"
ADD CONSTRAINT "ReportNote_reportId_fkey"
FOREIGN KEY ("reportId") REFERENCES "Report"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportNote"
ADD CONSTRAINT "ReportNote_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportEvidence"
ADD CONSTRAINT "ReportEvidence_reportId_fkey"
FOREIGN KEY ("reportId") REFERENCES "Report"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportEvidence"
ADD CONSTRAINT "ReportEvidence_capturedById_fkey"
FOREIGN KEY ("capturedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep terminal reports internally coherent.
ALTER TABLE "Report"
ADD CONSTRAINT "Report_terminal_resolution_check"
CHECK (
    (
        "status" IN ('RESOLVED', 'DISMISSED')
        AND "decision" IS NOT NULL
        AND "resolution" IS NOT NULL
        AND "resolvedAt" IS NOT NULL
    )
    OR
    (
        "status" IN ('OPEN', 'REVIEWING')
        AND "decision" IS NULL
        AND "resolution" IS NULL
        AND "resolvedAt" IS NULL
        AND "resolvedById" IS NULL
    )
);
