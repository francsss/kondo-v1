-- Part 5: additive Opportunities domain (scholarships, internships, jobs,
-- research opportunities and programs), the private candidate document vault,
-- and the Kondo application workflow.
--
-- This migration is additive only. It does not touch the legacy Scholarship,
-- ScholarshipUniversity, ScholarshipFavorite or ScholarshipAgent tables: those
-- keep serving the existing Student Hub directory and are surfaced in unified
-- search through a read-only compatibility adapter instead of being rewritten.
-- Marketplace, Housing, Communities, Meet, Explore, media and conversations are
-- likewise unchanged.
--
-- The generated diff for this schema also proposed dropping the eight GIN
-- searchVector indexes and the Community owner-membership constraint, because
-- Prisma models those columns as Unsupported("tsvector") and cannot see their
-- GENERATED ALWAYS definitions. Those statements were removed deliberately:
-- global search must keep working. Opportunity's own search vector is created
-- as a generated column at the end of this file, matching the convention in
-- 20260717000000_search_full_text.

-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('SCHOLARSHIP', 'INTERNSHIP', 'GRADUATE_INTERNSHIP', 'PART_TIME_JOB', 'FULL_TIME_JOB', 'CAMPUS_JOB', 'RESEARCH_OPPORTUNITY', 'VOLUNTEERING', 'COMPETITION', 'EXCHANGE_PROGRAM', 'SUMMER_PROGRAM', 'OTHER_PROGRAM');

-- CreateEnum
CREATE TYPE "OpportunityPublisherType" AS ENUM ('ORGANIZATION', 'EDITORIAL', 'LEGACY_SCHOLARSHIP_AGENT');

-- CreateEnum
CREATE TYPE "OpportunityLifecycleStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'PAUSED', 'CLOSED', 'EXPIRED', 'REJECTED', 'REMOVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OpportunityApplicationMethod" AS ENUM ('KONDO_APPLICATION', 'EXTERNAL_URL', 'EMAIL', 'INFORMATION_ONLY', 'NOMINATION_REQUIRED');

-- CreateEnum
CREATE TYPE "OpportunityWorkMode" AS ENUM ('ON_SITE', 'REMOTE', 'HYBRID', 'CAMPUS', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "OpportunityFundingType" AS ENUM ('FULLY_FUNDED', 'PARTIALLY_FUNDED', 'TUITION_ONLY', 'STIPEND_ONLY', 'FEE_WAIVER', 'OTHER');

-- CreateEnum
CREATE TYPE "OpportunityEmploymentType" AS ENUM ('INTERNSHIP', 'PART_TIME', 'FULL_TIME', 'TEMPORARY', 'CONTRACT', 'CAMPUS', 'VOLUNTEER', 'RESEARCH_ASSISTANT', 'TEACHING_ASSISTANT');

-- CreateEnum
CREATE TYPE "OpportunityExperienceLevel" AS ENUM ('NO_EXPERIENCE', 'ENTRY_LEVEL', 'INTERMEDIATE', 'EXPERIENCED', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "OpportunitySalaryPeriod" AS ENUM ('HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR', 'TOTAL');

-- CreateEnum
CREATE TYPE "OpportunityBenefitType" AS ENUM ('TUITION', 'ACCOMMODATION', 'STIPEND', 'SALARY', 'INSURANCE', 'TRAVEL', 'REGISTRATION_FEE', 'MEALS', 'TRANSPORT', 'VISA_SUPPORT', 'HOUSING_SUPPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "OpportunityBenefitConfidence" AS ENUM ('CONFIRMED', 'POSSIBLE', 'NOT_SPECIFIED');

-- CreateEnum
CREATE TYPE "OpportunityEligibilityRuleType" AS ENUM ('ACCOUNT_JOURNEY', 'STUDENT_STATUS', 'DEGREE_LEVEL', 'UNIVERSITY', 'FIELD_OF_STUDY', 'GRADUATION_YEAR', 'COUNTRY', 'NATIONALITY', 'RESIDENCE', 'AGE', 'GPA', 'LANGUAGE', 'EXPERIENCE', 'SKILL', 'AVAILABILITY', 'ENROLLMENT_STATUS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "OpportunityEligibilityOperator" AS ENUM ('EQUALS', 'NOT_EQUALS', 'IN', 'NOT_IN', 'AT_LEAST', 'AT_MOST', 'BETWEEN', 'EXISTS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "OpportunityLanguageLevel" AS ENUM ('BASIC', 'INTERMEDIATE', 'ADVANCED', 'FLUENT', 'NATIVE');

-- CreateEnum
CREATE TYPE "OpportunityDocumentCategory" AS ENUM ('CV', 'RESUME', 'TRANSCRIPT', 'ENROLLMENT_CERTIFICATE', 'RECOMMENDATION_LETTER', 'MOTIVATION_LETTER', 'LANGUAGE_CERTIFICATE', 'PORTFOLIO', 'RESEARCH_PROPOSAL', 'PASSPORT_COPY', 'OTHER');

-- CreateEnum
CREATE TYPE "OpportunityQuestionType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'SELECT', 'MULTI_SELECT', 'DATE', 'NUMBER', 'BOOLEAN', 'FILE', 'CONSENT');

-- CreateEnum
CREATE TYPE "OpportunityApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'MORE_INFORMATION_REQUIRED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'ACCEPTED', 'DECLINED_BY_APPLICANT', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OpportunityMediaKind" AS ENUM ('COVER', 'GALLERY', 'PUBLIC_DOCUMENT');


-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN     "notificationOpportunities" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "OpportunityType" NOT NULL,
    "lifecycle" "OpportunityLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "publisherType" "OpportunityPublisherType" NOT NULL,
    "publisherOrganizationId" TEXT,
    "scholarshipAgentId" TEXT,
    "createdByUserId" TEXT,
    "universityId" TEXT,
    "countryId" TEXT,
    "cityId" TEXT,
    "title" VARCHAR(180) NOT NULL,
    "shortDescription" VARCHAR(400) NOT NULL,
    "description" TEXT NOT NULL,
    "workMode" "OpportunityWorkMode" NOT NULL DEFAULT 'UNSPECIFIED',
    "locationLabel" VARCHAR(200),
    "applicationMethod" "OpportunityApplicationMethod" NOT NULL,
    "externalApplicationUrl" VARCHAR(500),
    "applicationEmail" VARCHAR(320),
    "officialSourceUrl" VARCHAR(500),
    "externalUrlBlockedAt" TIMESTAMP(3),
    "applicationOpenAt" TIMESTAMP(3),
    "applicationDeadline" TIMESTAMP(3),
    "rollingApplications" BOOLEAN NOT NULL DEFAULT false,
    "expectedDecisionDate" DATE,
    "opportunityStartDate" DATE,
    "opportunityEndDate" DATE,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
    "publicationBlockedAt" TIMESTAMP(3),
    "publicationBlockedById" TEXT,
    "moderationNote" VARCHAR(2000),
    "publisherVisibleNote" VARCHAR(2000),
    "legacySourceKey" VARCHAR(300),
    "publishedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityScholarshipDetail" (
    "opportunityId" TEXT NOT NULL,
    "fundingType" "OpportunityFundingType" NOT NULL,
    "tuitionCoverage" VARCHAR(300),
    "accommodationCoverage" VARCHAR(300),
    "monthlyStipendMinor" INTEGER,
    "stipendCurrency" VARCHAR(3),
    "insuranceCoverage" VARCHAR(300),
    "travelCoverage" VARCHAR(300),
    "applicationFeeMinor" INTEGER,
    "applicationFeeCurrency" VARCHAR(3),
    "nominationRequired" BOOLEAN NOT NULL DEFAULT false,
    "targetPrograms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "intakeLabel" VARCHAR(120),
    "studyLanguage" VARCHAR(80),
    "durationLabel" VARCHAR(120),
    "renewalConditions" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityScholarshipDetail_pkey" PRIMARY KEY ("opportunityId")
);

-- CreateTable
CREATE TABLE "OpportunityJobDetail" (
    "opportunityId" TEXT NOT NULL,
    "employmentType" "OpportunityEmploymentType" NOT NULL,
    "roleTitle" VARCHAR(180),
    "department" VARCHAR(160),
    "experienceLevel" "OpportunityExperienceLevel" NOT NULL DEFAULT 'UNSPECIFIED',
    "weeklyHours" INTEGER,
    "durationLabel" VARCHAR(120),
    "salaryMinMinor" INTEGER,
    "salaryMaxMinor" INTEGER,
    "salaryCurrency" VARCHAR(3),
    "salaryPeriod" "OpportunitySalaryPeriod",
    "salaryNegotiable" BOOLEAN NOT NULL DEFAULT false,
    "paid" BOOLEAN,
    "visaSupport" BOOLEAN,
    "housingSupport" BOOLEAN,
    "conversionPotential" BOOLEAN,
    "numberOfOpenings" INTEGER,
    "technicalSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "softSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityJobDetail_pkey" PRIMARY KEY ("opportunityId")
);

-- CreateTable
CREATE TABLE "OpportunityDegreeLevel" (
    "opportunityId" TEXT NOT NULL,
    "degreeLevel" "StudyLevel" NOT NULL,

    CONSTRAINT "OpportunityDegreeLevel_pkey" PRIMARY KEY ("opportunityId","degreeLevel")
);

-- CreateTable
CREATE TABLE "OpportunityFieldOfStudy" (
    "opportunityId" TEXT NOT NULL,
    "fieldKey" VARCHAR(80) NOT NULL,

    CONSTRAINT "OpportunityFieldOfStudy_pkey" PRIMARY KEY ("opportunityId","fieldKey")
);

-- CreateTable
CREATE TABLE "OpportunityLanguageRequirement" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "language" VARCHAR(80) NOT NULL,
    "level" "OpportunityLanguageLevel" NOT NULL,
    "certificateType" VARCHAR(80),
    "required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OpportunityLanguageRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityEligibilityRule" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "ruleType" "OpportunityEligibilityRuleType" NOT NULL,
    "operator" "OpportunityEligibilityOperator" NOT NULL,
    "structuredValue" JSONB NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "publicLabel" VARCHAR(300) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityEligibilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityBenefit" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "type" "OpportunityBenefitType" NOT NULL,
    "amountMinor" INTEGER,
    "currency" VARCHAR(3),
    "period" "OpportunitySalaryPeriod",
    "description" VARCHAR(400),
    "confidence" "OpportunityBenefitConfidence" NOT NULL DEFAULT 'NOT_SPECIFIED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OpportunityBenefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityApplicationRequirement" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "documentType" "OpportunityDocumentCategory" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "description" VARCHAR(400),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OpportunityApplicationRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityApplicationQuestion" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "type" "OpportunityQuestionType" NOT NULL,
    "label" VARCHAR(300) NOT NULL,
    "description" VARCHAR(600),
    "required" BOOLEAN NOT NULL DEFAULT true,
    "options" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityApplicationQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityMedia" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "kind" "OpportunityMediaKind" NOT NULL,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "altText" VARCHAR(240),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunitySaved" (
    "userId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "remindBeforeDays" INTEGER,
    "lastRemindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunitySaved_pkey" PRIMARY KEY ("userId","opportunityId")
);

-- CreateTable
CREATE TABLE "UserOpportunityDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "category" "OpportunityDocumentCategory" NOT NULL,
    "displayName" VARCHAR(200) NOT NULL,
    "institution" VARCHAR(200),
    "issuedOn" DATE,
    "expiresOn" DATE,
    "language" VARCHAR(80),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOpportunityDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOpportunityProfile" (
    "userId" TEXT NOT NULL,
    "preferredTypes" "OpportunityType"[] DEFAULT ARRAY[]::"OpportunityType"[],
    "preferredCityIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "remotePreference" "OpportunityWorkMode",
    "experienceLevel" "OpportunityExperienceLevel" NOT NULL DEFAULT 'UNSPECIFIED',
    "availabilityFrom" DATE,
    "professionalInterests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "workAuthorizationNote" VARCHAR(500),
    "portfolioUrl" VARCHAR(500),
    "professionalProfileUrl" VARCHAR(500),
    "defaultCvDocumentId" TEXT,
    "defaultTranscriptDocumentId" TEXT,
    "coverLetterTemplate" TEXT,
    "recommendationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "deadlineReminderDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOpportunityProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "OpportunityApplication" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "applicantUserId" TEXT NOT NULL,
    "organizationId" TEXT,
    "status" "OpportunityApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "assignedReviewerUserId" TEXT,
    "applicantSnapshot" JSONB,
    "consentVersion" VARCHAR(40),
    "submittedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "informationRequestedAt" TIMESTAMP(3),
    "informationDueAt" TIMESTAMP(3),
    "offerResponseDueAt" TIMESTAMP(3),
    "applicantLastViewedAt" TIMESTAMP(3),
    "reviewerLastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityApplicationAnswer" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerText" TEXT,
    "answerStructured" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityApplicationAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityApplicationDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userDocumentId" TEXT NOT NULL,
    "requirementId" TEXT,
    "category" "OpportunityDocumentCategory" NOT NULL,
    "displayNameSnapshot" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityApplicationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityApplicationStatusHistory" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "OpportunityApplicationStatus",
    "toStatus" "OpportunityApplicationStatus" NOT NULL,
    "actingUserId" TEXT,
    "applicantVisibleNote" VARCHAR(2000),
    "internalNote" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityApplicationStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_slug_key" ON "Opportunity"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_legacySourceKey_key" ON "Opportunity"("legacySourceKey");

-- CreateIndex
CREATE INDEX "Opportunity_lifecycle_applicationDeadline_idx" ON "Opportunity"("lifecycle", "applicationDeadline");

-- CreateIndex
CREATE INDEX "Opportunity_lifecycle_publishedAt_idx" ON "Opportunity"("lifecycle", "publishedAt");

-- CreateIndex
CREATE INDEX "Opportunity_type_lifecycle_publishedAt_idx" ON "Opportunity"("type", "lifecycle", "publishedAt");

-- CreateIndex
CREATE INDEX "Opportunity_publisherOrganizationId_lifecycle_publishedAt_idx" ON "Opportunity"("publisherOrganizationId", "lifecycle", "publishedAt");

-- CreateIndex
CREATE INDEX "Opportunity_scholarshipAgentId_idx" ON "Opportunity"("scholarshipAgentId");

-- CreateIndex
CREATE INDEX "Opportunity_universityId_lifecycle_idx" ON "Opportunity"("universityId", "lifecycle");

-- CreateIndex
CREATE INDEX "Opportunity_countryId_cityId_lifecycle_idx" ON "Opportunity"("countryId", "cityId", "lifecycle");

-- CreateIndex
CREATE INDEX "Opportunity_createdByUserId_createdAt_idx" ON "Opportunity"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Opportunity_lifecycle_expiresAt_idx" ON "Opportunity"("lifecycle", "expiresAt");

-- CreateIndex
CREATE INDEX "OpportunityScholarshipDetail_fundingType_idx" ON "OpportunityScholarshipDetail"("fundingType");

-- CreateIndex
CREATE INDEX "OpportunityJobDetail_employmentType_experienceLevel_idx" ON "OpportunityJobDetail"("employmentType", "experienceLevel");

-- CreateIndex
CREATE INDEX "OpportunityDegreeLevel_degreeLevel_opportunityId_idx" ON "OpportunityDegreeLevel"("degreeLevel", "opportunityId");

-- CreateIndex
CREATE INDEX "OpportunityFieldOfStudy_fieldKey_opportunityId_idx" ON "OpportunityFieldOfStudy"("fieldKey", "opportunityId");

-- CreateIndex
CREATE INDEX "OpportunityLanguageRequirement_language_level_idx" ON "OpportunityLanguageRequirement"("language", "level");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityLanguageRequirement_opportunityId_language_key" ON "OpportunityLanguageRequirement"("opportunityId", "language");

-- CreateIndex
CREATE INDEX "OpportunityEligibilityRule_opportunityId_sortOrder_idx" ON "OpportunityEligibilityRule"("opportunityId", "sortOrder");

-- CreateIndex
CREATE INDEX "OpportunityEligibilityRule_ruleType_idx" ON "OpportunityEligibilityRule"("ruleType");

-- CreateIndex
CREATE INDEX "OpportunityBenefit_opportunityId_sortOrder_idx" ON "OpportunityBenefit"("opportunityId", "sortOrder");

-- CreateIndex
CREATE INDEX "OpportunityBenefit_type_confidence_idx" ON "OpportunityBenefit"("type", "confidence");

-- CreateIndex
CREATE INDEX "OpportunityApplicationRequirement_opportunityId_sortOrder_idx" ON "OpportunityApplicationRequirement"("opportunityId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityApplicationRequirement_opportunityId_documentTyp_key" ON "OpportunityApplicationRequirement"("opportunityId", "documentType");

-- CreateIndex
CREATE INDEX "OpportunityApplicationQuestion_opportunityId_sortOrder_idx" ON "OpportunityApplicationQuestion"("opportunityId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityMedia_mediaId_key" ON "OpportunityMedia"("mediaId");

-- CreateIndex
CREATE INDEX "OpportunityMedia_opportunityId_sortOrder_idx" ON "OpportunityMedia"("opportunityId", "sortOrder");

-- CreateIndex
CREATE INDEX "OpportunityMedia_opportunityId_isCover_idx" ON "OpportunityMedia"("opportunityId", "isCover");

-- CreateIndex
CREATE INDEX "OpportunitySaved_userId_createdAt_idx" ON "OpportunitySaved"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OpportunitySaved_opportunityId_idx" ON "OpportunitySaved"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "UserOpportunityDocument_mediaId_key" ON "UserOpportunityDocument"("mediaId");

-- CreateIndex
CREATE INDEX "UserOpportunityDocument_userId_category_createdAt_idx" ON "UserOpportunityDocument"("userId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "UserOpportunityDocument_userId_archivedAt_idx" ON "UserOpportunityDocument"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "OpportunityApplication_applicantUserId_status_updatedAt_idx" ON "OpportunityApplication"("applicantUserId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "OpportunityApplication_organizationId_status_submittedAt_idx" ON "OpportunityApplication"("organizationId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "OpportunityApplication_opportunityId_status_submittedAt_idx" ON "OpportunityApplication"("opportunityId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "OpportunityApplication_assignedReviewerUserId_status_idx" ON "OpportunityApplication"("assignedReviewerUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityApplication_opportunityId_applicantUserId_key" ON "OpportunityApplication"("opportunityId", "applicantUserId");

-- CreateIndex
CREATE INDEX "OpportunityApplicationAnswer_questionId_idx" ON "OpportunityApplicationAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityApplicationAnswer_applicationId_questionId_key" ON "OpportunityApplicationAnswer"("applicationId", "questionId");

-- CreateIndex
CREATE INDEX "OpportunityApplicationDocument_applicationId_category_idx" ON "OpportunityApplicationDocument"("applicationId", "category");

-- CreateIndex
CREATE INDEX "OpportunityApplicationDocument_userDocumentId_idx" ON "OpportunityApplicationDocument"("userDocumentId");

-- CreateIndex
CREATE INDEX "OpportunityApplicationDocument_requirementId_idx" ON "OpportunityApplicationDocument"("requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityApplicationDocument_applicationId_userDocumentId_key" ON "OpportunityApplicationDocument"("applicationId", "userDocumentId");

-- CreateIndex
CREATE INDEX "OpportunityApplicationStatusHistory_applicationId_createdAt_idx" ON "OpportunityApplicationStatusHistory"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "OpportunityApplicationStatusHistory_actingUserId_createdAt_idx" ON "OpportunityApplicationStatusHistory"("actingUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_publisherOrganizationId_fkey" FOREIGN KEY ("publisherOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_scholarshipAgentId_fkey" FOREIGN KEY ("scholarshipAgentId") REFERENCES "ScholarshipAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_publicationBlockedById_fkey" FOREIGN KEY ("publicationBlockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityScholarshipDetail" ADD CONSTRAINT "OpportunityScholarshipDetail_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityJobDetail" ADD CONSTRAINT "OpportunityJobDetail_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityDegreeLevel" ADD CONSTRAINT "OpportunityDegreeLevel_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityFieldOfStudy" ADD CONSTRAINT "OpportunityFieldOfStudy_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityLanguageRequirement" ADD CONSTRAINT "OpportunityLanguageRequirement_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityEligibilityRule" ADD CONSTRAINT "OpportunityEligibilityRule_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityBenefit" ADD CONSTRAINT "OpportunityBenefit_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityApplicationRequirement" ADD CONSTRAINT "OpportunityApplicationRequirement_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityApplicationQuestion" ADD CONSTRAINT "OpportunityApplicationQuestion_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityMedia" ADD CONSTRAINT "OpportunityMedia_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityMedia" ADD CONSTRAINT "OpportunityMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunitySaved" ADD CONSTRAINT "OpportunitySaved_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunitySaved" ADD CONSTRAINT "OpportunitySaved_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOpportunityDocument" ADD CONSTRAINT "UserOpportunityDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOpportunityDocument" ADD CONSTRAINT "UserOpportunityDocument_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOpportunityProfile" ADD CONSTRAINT "UserOpportunityProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityApplication" ADD CONSTRAINT "OpportunityApplication_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityApplication" ADD CONSTRAINT "OpportunityApplication_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityApplication" ADD CONSTRAINT "OpportunityApplication_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityApplication" ADD CONSTRAINT "OpportunityApplication_assignedReviewerUserId_fkey" FOREIGN KEY ("assignedReviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityApplicationAnswer" ADD CONSTRAINT "OpportunityApplicationAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OpportunityApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityApplicationAnswer" ADD CONSTRAINT "OpportunityApplicationAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "OpportunityApplicationQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityApplicationDocument" ADD CONSTRAINT "OpportunityApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OpportunityApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityApplicationDocument" ADD CONSTRAINT "OpportunityApplicationDocument_userDocumentId_fkey" FOREIGN KEY ("userDocumentId") REFERENCES "UserOpportunityDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityApplicationDocument" ADD CONSTRAINT "OpportunityApplicationDocument_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "OpportunityApplicationRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityApplicationStatusHistory" ADD CONSTRAINT "OpportunityApplicationStatusHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OpportunityApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityApplicationStatusHistory" ADD CONSTRAINT "OpportunityApplicationStatusHistory_actingUserId_fkey" FOREIGN KEY ("actingUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "MeetDiscoveryProfile_discoveryCityId_discoveryUniversityId_near" RENAME TO "MeetDiscoveryProfile_discoveryCityId_discoveryUniversityId__idx";

-- RenameIndex
ALTER INDEX "StoryEntityLink_storyId_type_cityId_universityId_communityId_ex" RENAME TO "StoryEntityLink_storyId_type_cityId_universityId_communityI_key";

-- RenameIndex
ALTER INDEX "UniversityPeriodConfiguration_universityId_campusId_isActive_id" RENAME TO "UniversityPeriodConfiguration_universityId_campusId_isActiv_idx";


-- Full-text search vector for unified opportunity search. Mirrors the existing
-- generated-column convention so the column can never drift from its source
-- columns, and is excluded from Prisma's managed DDL.
ALTER TABLE "Opportunity"
ADD COLUMN "searchVector" tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("shortDescription", '')), 'B') ||
  setweight(to_tsvector('simple', coalesce("locationLabel", '')), 'C')
) STORED;

CREATE INDEX "Opportunity_searchVector_idx" ON "Opportunity" USING GIN ("searchVector");
