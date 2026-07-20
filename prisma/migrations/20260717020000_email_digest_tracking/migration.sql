ALTER TABLE "UserPreference"
ADD COLUMN "lastDigestSentAt" TIMESTAMP(3);

DROP INDEX "UserPreference_emailDigest_updatedAt_idx";

CREATE INDEX "UserPreference_emailDigest_lastDigestSentAt_idx"
ON "UserPreference"("emailDigest", "lastDigestSentAt");
