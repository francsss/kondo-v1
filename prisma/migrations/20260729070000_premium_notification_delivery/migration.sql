ALTER TABLE "UserPreference"
ADD COLUMN "notificationFriends" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notificationEvents" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notificationTransfers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notificationUniversity" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notificationSecurity" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notificationMarketing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "notificationSounds" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "notificationHaptics" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "PushSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" VARCHAR(320),
  "expiresAt" TIMESTAMP(3),
  "lastDeliveredAt" TIMESTAMP(3),
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key"
ON "PushSubscription"("endpoint");

CREATE INDEX "PushSubscription_userId_disabledAt_idx"
ON "PushSubscription"("userId", "disabledAt");

ALTER TABLE "PushSubscription"
ADD CONSTRAINT "PushSubscription_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
