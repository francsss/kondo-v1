ALTER TABLE "StudyEssentialOrder"
ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(128);

CREATE UNIQUE INDEX IF NOT EXISTS "StudyEssentialOrder_userId_paymentProvider_idempotencyKey_key"
ON "StudyEssentialOrder"("userId", "paymentProvider", "idempotencyKey");
