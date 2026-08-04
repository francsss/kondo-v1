CREATE TABLE IF NOT EXISTS "StudyEssentialChapter" (
  "id" TEXT NOT NULL,
  "essentialId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudyEssentialChapter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudyEssentialChapter_essentialId_position_key"
  ON "StudyEssentialChapter"("essentialId", "position");
CREATE INDEX IF NOT EXISTS "StudyEssentialChapter_essentialId_position_idx"
  ON "StudyEssentialChapter"("essentialId", "position");

CREATE TABLE IF NOT EXISTS "StudyReadingProgress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "essentialId" TEXT NOT NULL,
  "chapterId" TEXT,
  "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudyReadingProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudyReadingProgress_userId_essentialId_key"
  ON "StudyReadingProgress"("userId", "essentialId");
CREATE INDEX IF NOT EXISTS "StudyReadingProgress_userId_lastReadAt_idx"
  ON "StudyReadingProgress"("userId", "lastReadAt");

CREATE TABLE IF NOT EXISTS "StudyNote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "essentialId" TEXT NOT NULL,
  "chapterId" TEXT,
  "highlight" VARCHAR(2000),
  "body" TEXT,
  "taskId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudyNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudyNote_userId_createdAt_idx"
  ON "StudyNote"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "StudyNote_essentialId_userId_idx"
  ON "StudyNote"("essentialId", "userId");

DO $$ BEGIN
  ALTER TABLE "StudyEssentialChapter"
    ADD CONSTRAINT "StudyEssentialChapter_essentialId_fkey"
    FOREIGN KEY ("essentialId") REFERENCES "StudyEssential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StudyReadingProgress"
    ADD CONSTRAINT "StudyReadingProgress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StudyReadingProgress"
    ADD CONSTRAINT "StudyReadingProgress_essentialId_fkey"
    FOREIGN KEY ("essentialId") REFERENCES "StudyEssential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StudyReadingProgress"
    ADD CONSTRAINT "StudyReadingProgress_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "StudyEssentialChapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StudyNote"
    ADD CONSTRAINT "StudyNote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StudyNote"
    ADD CONSTRAINT "StudyNote_essentialId_fkey"
    FOREIGN KEY ("essentialId") REFERENCES "StudyEssential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StudyNote"
    ADD CONSTRAINT "StudyNote_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "StudyEssentialChapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StudyNote"
    ADD CONSTRAINT "StudyNote_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "AcademicTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
