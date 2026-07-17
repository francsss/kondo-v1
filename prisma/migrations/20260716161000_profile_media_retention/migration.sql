ALTER TABLE "MediaAsset"
ADD COLUMN "retainedAt" TIMESTAMP(3),
ADD COLUMN "retentionReason" VARCHAR(500);

CREATE INDEX "MediaAsset_retainedAt_status_idx"
ON "MediaAsset"("retainedAt", "status");
