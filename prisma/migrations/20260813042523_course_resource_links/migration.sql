-- Links a student's owned resource to one of their courses.
--
-- Hand-written and deliberately additive. `prisma migrate diff` also wanted to
-- drop the generated `searchVector` columns' defaults, their GIN indexes and a
-- community trigger constraint, and to rename three indexes — all of which come
-- from hand-written SQL in earlier migrations that Prisma cannot round-trip.
-- None of that is part of this change, and applying it would break full-text
-- search, so this migration contains only the new table.
--
-- Nothing existing is altered: one new table, its indexes and its foreign keys.

CREATE TABLE "CourseResource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "essentialId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseResource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CourseResource_userId_courseId_idx" ON "CourseResource"("userId", "courseId");

CREATE INDEX "CourseResource_essentialId_idx" ON "CourseResource"("essentialId");

-- One link per student, course and resource: linking twice is a no-op.
CREATE UNIQUE INDEX "CourseResource_userId_courseId_essentialId_key" ON "CourseResource"("userId", "courseId", "essentialId");

ALTER TABLE "CourseResource" ADD CONSTRAINT "CourseResource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseResource" ADD CONSTRAINT "CourseResource_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ScheduleCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseResource" ADD CONSTRAINT "CourseResource_essentialId_fkey" FOREIGN KEY ("essentialId") REFERENCES "StudyEssential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
