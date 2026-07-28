ALTER TABLE "ScheduleCourse"
  DROP CONSTRAINT IF EXISTS "ScheduleCourse_time_check";

ALTER TABLE "ScheduleCourse"
  ALTER COLUMN "startTime" DROP NOT NULL,
  ALTER COLUMN "endTime" DROP NOT NULL;

ALTER TABLE "ScheduleCourse"
  ADD CONSTRAINT "ScheduleCourse_time_or_period_check"
  CHECK (
    (
      "startTime" IS NOT NULL
      AND "endTime" IS NOT NULL
      AND "startTime" < "endTime"
    )
    OR
    (
      "startTime" IS NULL
      AND "endTime" IS NULL
      AND "startPeriod" IS NOT NULL
      AND "endPeriod" IS NOT NULL
      AND "startPeriod" <= "endPeriod"
    )
  );
