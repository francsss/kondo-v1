ALTER TABLE "Message"
ADD COLUMN IF NOT EXISTS "clientMessageId" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "Message_senderId_clientMessageId_key"
ON "Message"("senderId", "clientMessageId");
