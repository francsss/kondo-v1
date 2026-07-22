ALTER TYPE "MediaPurpose" ADD VALUE 'SCHEDULE_IMPORT';

CREATE TYPE "ScheduleWeekPattern" AS ENUM ('ALL', 'ODD', 'EVEN', 'CUSTOM');
CREATE TYPE "ScheduleImportStatus" AS ENUM ('UPLOADED', 'ANALYZING', 'REVIEW_REQUIRED', 'CONFIRMED', 'FAILED', 'CANCELLED');
CREATE TYPE "ScheduleCourseSource" AS ENUM ('IMPORT', 'MANUAL');
CREATE TYPE "ClassPeriodPart" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');
CREATE TYPE "ScholarshipFundingType" AS ENUM ('FULL', 'PARTIAL');
CREATE TYPE "ScholarshipApplicationStatus" AS ENUM ('SAVED', 'PREPARING', 'APPLIED', 'INTERVIEW', 'ACCEPTED', 'REJECTED');

CREATE TABLE "Campus" (
  "id" TEXT NOT NULL,
  "universityId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" VARCHAR(300),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Campus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AcademicTerm" (
  "id" TEXT NOT NULL,
  "universityId" TEXT NOT NULL,
  "campusId" TEXT,
  "name" TEXT NOT NULL,
  "startsOn" DATE NOT NULL,
  "endsOn" DATE NOT NULL,
  "firstWeekStartsOn" DATE NOT NULL,
  "totalWeeks" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcademicTerm_dates_check" CHECK ("endsOn" >= "startsOn"),
  CONSTRAINT "AcademicTerm_weeks_check" CHECK ("totalWeeks" BETWEEN 1 AND 60)
);

CREATE TABLE "UniversityPeriodConfiguration" (
  "id" TEXT NOT NULL,
  "universityId" TEXT NOT NULL,
  "campusId" TEXT,
  "name" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  "primaryLanguage" TEXT NOT NULL DEFAULT 'zh-CN',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UniversityPeriodConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClassPeriod" (
  "id" TEXT NOT NULL,
  "configurationId" TEXT NOT NULL,
  "periodNumber" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "startTime" VARCHAR(5) NOT NULL,
  "endTime" VARCHAR(5) NOT NULL,
  "displayOrder" INTEGER NOT NULL,
  "part" "ClassPeriodPart",
  "isBreak" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClassPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClassPeriod_number_check" CHECK ("periodNumber" > 0),
  CONSTRAINT "ClassPeriod_time_check" CHECK ("startTime" < "endTime")
);

CREATE TABLE "CustomPeriodConfiguration" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "universityName" TEXT NOT NULL,
  "campusName" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  "periods" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "submittedForReviewAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomPeriodConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentSchedule" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "universityId" TEXT,
  "campusId" TEXT,
  "academicTermId" TEXT,
  "title" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  "periodConfigurationSnapshot" JSONB,
  "confirmedAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleCourse" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "courseName" TEXT NOT NULL,
  "teacher" TEXT,
  "dayOfWeek" INTEGER NOT NULL,
  "specificDate" DATE,
  "startPeriod" INTEGER,
  "endPeriod" INTEGER,
  "startTime" VARCHAR(5) NOT NULL,
  "endTime" VARCHAR(5) NOT NULL,
  "room" TEXT,
  "building" TEXT,
  "campusLabel" TEXT,
  "startWeek" INTEGER,
  "endWeek" INTEGER,
  "weekPattern" "ScheduleWeekPattern" NOT NULL DEFAULT 'ALL',
  "weeks" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "language" TEXT,
  "notes" VARCHAR(2000),
  "color" VARCHAR(9) NOT NULL DEFAULT '#22A06B',
  "isOptional" BOOLEAN NOT NULL DEFAULT false,
  "confidence" DOUBLE PRECISION,
  "source" "ScheduleCourseSource" NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduleCourse_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScheduleCourse_day_check" CHECK ("dayOfWeek" BETWEEN 1 AND 7),
  CONSTRAINT "ScheduleCourse_time_check" CHECK ("startTime" < "endTime"),
  CONSTRAINT "ScheduleCourse_confidence_check" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1))
);

CREATE TABLE "ScheduleImport" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "universityId" TEXT,
  "campusId" TEXT,
  "academicTermId" TEXT,
  "scheduleId" TEXT,
  "status" "ScheduleImportStatus" NOT NULL DEFAULT 'UPLOADED',
  "provider" TEXT,
  "model" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "errorCode" TEXT,
  "errorMessage" VARCHAR(500),
  "retainSource" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduleImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleImportFile" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "pageCount" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ScheduleImportFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleImportResult" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "extractedJson" JSONB NOT NULL,
  "warnings" JSONB NOT NULL,
  "courseCount" INTEGER NOT NULL,
  "reviewCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduleImportResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Scholarship" (
  "id" TEXT NOT NULL,
  "universityId" TEXT,
  "title" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "city" TEXT,
  "studyLevels" "StudyLevel"[],
  "fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "eligibleNationalities" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "fundingType" "ScholarshipFundingType" NOT NULL,
  "deadline" DATE,
  "applicationUrl" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Scholarship_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScholarshipFavorite" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scholarshipId" TEXT NOT NULL,
  "status" "ScholarshipApplicationStatus" NOT NULL DEFAULT 'SAVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScholarshipFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Campus_universityId_name_key" ON "Campus"("universityId", "name");
CREATE INDEX "Campus_universityId_isActive_name_idx" ON "Campus"("universityId", "isActive", "name");
CREATE INDEX "AcademicTerm_universityId_isActive_startsOn_idx" ON "AcademicTerm"("universityId", "isActive", "startsOn");
CREATE INDEX "AcademicTerm_campusId_idx" ON "AcademicTerm"("campusId");
CREATE INDEX "UniversityPeriodConfiguration_universityId_campusId_isActive_idx" ON "UniversityPeriodConfiguration"("universityId", "campusId", "isActive");
CREATE INDEX "UniversityPeriodConfiguration_universityId_isDefault_idx" ON "UniversityPeriodConfiguration"("universityId", "isDefault");
CREATE UNIQUE INDEX "UniversityPeriodConfiguration_one_default_idx" ON "UniversityPeriodConfiguration"("universityId", COALESCE("campusId", '')) WHERE "isDefault" = true;
CREATE UNIQUE INDEX "ClassPeriod_configurationId_periodNumber_key" ON "ClassPeriod"("configurationId", "periodNumber");
CREATE INDEX "ClassPeriod_configurationId_displayOrder_idx" ON "ClassPeriod"("configurationId", "displayOrder");
CREATE INDEX "CustomPeriodConfiguration_ownerId_isActive_updatedAt_idx" ON "CustomPeriodConfiguration"("ownerId", "isActive", "updatedAt");
CREATE INDEX "StudentSchedule_ownerId_isActive_updatedAt_idx" ON "StudentSchedule"("ownerId", "isActive", "updatedAt");
CREATE INDEX "StudentSchedule_universityId_idx" ON "StudentSchedule"("universityId");
CREATE INDEX "StudentSchedule_academicTermId_idx" ON "StudentSchedule"("academicTermId");
CREATE INDEX "ScheduleCourse_scheduleId_dayOfWeek_startTime_idx" ON "ScheduleCourse"("scheduleId", "dayOfWeek", "startTime");
CREATE INDEX "ScheduleImport_ownerId_status_createdAt_idx" ON "ScheduleImport"("ownerId", "status", "createdAt");
CREATE INDEX "ScheduleImport_universityId_idx" ON "ScheduleImport"("universityId");
CREATE UNIQUE INDEX "ScheduleImportFile_mediaAssetId_key" ON "ScheduleImportFile"("mediaAssetId");
CREATE INDEX "ScheduleImportFile_importId_idx" ON "ScheduleImportFile"("importId");
CREATE UNIQUE INDEX "ScheduleImportResult_importId_key" ON "ScheduleImportResult"("importId");
CREATE INDEX "Scholarship_isActive_deadline_idx" ON "Scholarship"("isActive", "deadline");
CREATE INDEX "Scholarship_universityId_idx" ON "Scholarship"("universityId");
CREATE UNIQUE INDEX "ScholarshipFavorite_userId_scholarshipId_key" ON "ScholarshipFavorite"("userId", "scholarshipId");
CREATE INDEX "ScholarshipFavorite_userId_status_updatedAt_idx" ON "ScholarshipFavorite"("userId", "status", "updatedAt");

ALTER TABLE "Campus" ADD CONSTRAINT "Campus_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicTerm" ADD CONSTRAINT "AcademicTerm_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicTerm" ADD CONSTRAINT "AcademicTerm_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UniversityPeriodConfiguration" ADD CONSTRAINT "UniversityPeriodConfiguration_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UniversityPeriodConfiguration" ADD CONSTRAINT "UniversityPeriodConfiguration_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClassPeriod" ADD CONSTRAINT "ClassPeriod_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "UniversityPeriodConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomPeriodConfiguration" ADD CONSTRAINT "CustomPeriodConfiguration_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentSchedule" ADD CONSTRAINT "StudentSchedule_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentSchedule" ADD CONSTRAINT "StudentSchedule_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentSchedule" ADD CONSTRAINT "StudentSchedule_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentSchedule" ADD CONSTRAINT "StudentSchedule_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduleCourse" ADD CONSTRAINT "ScheduleCourse_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "StudentSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleImport" ADD CONSTRAINT "ScheduleImport_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleImport" ADD CONSTRAINT "ScheduleImport_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduleImport" ADD CONSTRAINT "ScheduleImport_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduleImport" ADD CONSTRAINT "ScheduleImport_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduleImport" ADD CONSTRAINT "ScheduleImport_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "StudentSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduleImportFile" ADD CONSTRAINT "ScheduleImportFile_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ScheduleImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleImportFile" ADD CONSTRAINT "ScheduleImportFile_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleImportResult" ADD CONSTRAINT "ScheduleImportResult_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ScheduleImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Scholarship" ADD CONSTRAINT "Scholarship_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScholarshipFavorite" ADD CONSTRAINT "ScholarshipFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScholarshipFavorite" ADD CONSTRAINT "ScholarshipFavorite_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE CASCADE ON UPDATE CASCADE;
