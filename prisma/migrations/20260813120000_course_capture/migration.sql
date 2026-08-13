-- Class-anchored captures: a typed line, a photo of the board, a handout, or
-- a spoken note.
--
-- Written by hand rather than diffed. `prisma migrate diff` still wants to
-- drop the generated `searchVector` columns and their GIN indexes, which it
-- cannot round-trip; this migration therefore contains only the additions.

-- New media kind. Audio is only ever produced by voice notes today.
ALTER TYPE "MediaKind" ADD VALUE IF NOT EXISTS 'AUDIO';

-- New upload purposes. Every purpose carries its own size, MIME and
-- visibility policy in `src/lib/media-policy.ts`.
ALTER TYPE "MediaPurpose" ADD VALUE IF NOT EXISTS 'COURSE_CAPTURE_IMAGE';
ALTER TYPE "MediaPurpose" ADD VALUE IF NOT EXISTS 'COURSE_CAPTURE_DOCUMENT';
ALTER TYPE "MediaPurpose" ADD VALUE IF NOT EXISTS 'COURSE_CAPTURE_AUDIO';

DO $$
BEGIN
  CREATE TYPE "CourseCaptureKind" AS ENUM ('NOTE', 'PHOTO', 'DOCUMENT', 'VOICE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "CourseCapture" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "kind" "CourseCaptureKind" NOT NULL,
  "body" TEXT,
  "mediaId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CourseCapture_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CourseCapture_mediaId_key"
  ON "CourseCapture"("mediaId");

CREATE INDEX IF NOT EXISTS "CourseCapture_userId_courseId_createdAt_idx"
  ON "CourseCapture"("userId", "courseId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "CourseCapture"
    ADD CONSTRAINT "CourseCapture_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "CourseCapture"
    ADD CONSTRAINT "CourseCapture_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "ScheduleCourse"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "CourseCapture"
    ADD CONSTRAINT "CourseCapture_mediaId_fkey"
    FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
