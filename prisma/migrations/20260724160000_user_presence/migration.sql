CREATE TABLE "UserPresence" (
    "userId" TEXT NOT NULL,
    "clientSessionId" VARCHAR(64) NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL,
    "currentPath" VARCHAR(240) NOT NULL,
    "device" VARCHAR(32) NOT NULL,
    "browser" VARCHAR(32) NOT NULL,
    "operatingSystem" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPresence_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "UserPresence_lastSeen_idx" ON "UserPresence"("lastSeen");
CREATE INDEX "UserPresence_connectedAt_idx" ON "UserPresence"("connectedAt");

ALTER TABLE "UserPresence"
ADD CONSTRAINT "UserPresence_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
