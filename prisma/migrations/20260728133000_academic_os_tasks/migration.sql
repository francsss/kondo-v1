CREATE TYPE "AcademicTaskKind" AS ENUM (
  'ASSIGNMENT',
  'PROJECT',
  'EXAM',
  'REMINDER',
  'EVENT'
);

CREATE TYPE "AcademicTaskStatus" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "AcademicTaskPriority" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH'
);

CREATE TABLE "AcademicTask" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "scheduleId" TEXT,
  "courseId" TEXT,
  "title" VARCHAR(200) NOT NULL,
  "description" VARCHAR(2000),
  "kind" "AcademicTaskKind" NOT NULL DEFAULT 'ASSIGNMENT',
  "status" "AcademicTaskStatus" NOT NULL DEFAULT 'PENDING',
  "priority" "AcademicTaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "dueAt" TIMESTAMP(3),
  "reminderAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AcademicTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AcademicTask_ownerId_status_dueAt_idx"
  ON "AcademicTask"("ownerId", "status", "dueAt");

CREATE INDEX "AcademicTask_scheduleId_status_idx"
  ON "AcademicTask"("scheduleId", "status");

CREATE INDEX "AcademicTask_courseId_idx"
  ON "AcademicTask"("courseId");

ALTER TABLE "AcademicTask"
  ADD CONSTRAINT "AcademicTask_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AcademicTask"
  ADD CONSTRAINT "AcademicTask_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "StudentSchedule"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AcademicTask"
  ADD CONSTRAINT "AcademicTask_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "ScheduleCourse"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
