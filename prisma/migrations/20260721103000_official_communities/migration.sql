ALTER TABLE "Community"
ADD COLUMN "isOfficial" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Community_isOfficial_status_createdAt_idx"
ON "Community"("isOfficial", "status", "createdAt");
