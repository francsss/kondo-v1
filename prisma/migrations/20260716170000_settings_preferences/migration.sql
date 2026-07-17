CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');
CREATE TYPE "AppLanguage" AS ENUM ('ENGLISH', 'FRENCH', 'CHINESE', 'ARABIC');
CREATE TYPE "NotificationDigest" AS ENUM ('NEVER', 'DAILY', 'WEEKLY');

CREATE TABLE "UserPreference" (
    "userId" TEXT NOT NULL,
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "language" "AppLanguage" NOT NULL DEFAULT 'ENGLISH',
    "notificationMessages" BOOLEAN NOT NULL DEFAULT true,
    "notificationComments" BOOLEAN NOT NULL DEFAULT true,
    "notificationMarketplace" BOOLEAN NOT NULL DEFAULT true,
    "notificationAnnouncements" BOOLEAN NOT NULL DEFAULT true,
    "emailDigest" "NotificationDigest" NOT NULL DEFAULT 'NEVER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "UserPreference_emailDigest_updatedAt_idx"
ON "UserPreference"("emailDigest", "updatedAt");

ALTER TABLE "UserPreference"
ADD CONSTRAINT "UserPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
