-- Part 2: additive professional organization workspaces.
-- Existing users, sessions, organizations, memberships, personal verification,
-- City Hub content, ScholarshipAgent rows, communities, and media are retained.

CREATE TYPE "OrganizationInvitationStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'CANCELLED',
  'REVOKED'
);
CREATE TYPE "OrganizationOwnershipTransferStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'CANCELLED',
  'EXPIRED'
);
CREATE TYPE "OrganizationVerificationRequestStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'MORE_INFORMATION_REQUIRED',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN',
  'SUSPENDED',
  'REVOKED'
);
CREATE TYPE "OrganizationVerificationDocumentType" AS ENUM (
  'BUSINESS_REGISTRATION',
  'UNIVERSITY_AUTHORIZATION',
  'ASSOCIATION_REGISTRATION',
  'REPRESENTATIVE_AUTHORIZATION',
  'OFFICIAL_LETTER',
  'ADDRESS_PROOF',
  'OTHER'
);
CREATE TYPE "OrganizationSizeRange" AS ENUM (
  'SOLO',
  'TWO_TO_TEN',
  'ELEVEN_TO_FIFTY',
  'FIFTY_ONE_TO_TWO_HUNDRED',
  'TWO_HUNDRED_PLUS'
);

ALTER TABLE "Organization"
  ADD COLUMN "tagline" VARCHAR(160),
  ADD COLUMN "extendedDescription" TEXT,
  ADD COLUMN "foundingYear" INTEGER,
  ADD COLUMN "sizeRange" "OrganizationSizeRange",
  ADD COLUMN "websiteWechat" VARCHAR(120),
  ADD COLUMN "publicAddress" VARCHAR(300),
  ADD COLUMN "serviceAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "supportedLanguages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "contactAudience" "ProfileAudience" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN "coverMediaId" TEXT,
  ADD COLUMN "isOfficialPartner" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "partnerSince" TIMESTAMP(3),
  ADD COLUMN "partnerGrantedById" TEXT,
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "suspensionReason" VARCHAR(1200),
  ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_foundingYear_check"
  CHECK (
    "foundingYear" IS NULL
    OR "foundingYear" BETWEEN 1000 AND 2200
  );

ALTER TABLE "OrganizationMembership"
  ADD COLUMN "removedAt" TIMESTAMP(3),
  ADD COLUMN "removedById" TEXT;

-- Part 1 used role names that were safe foundations but were not the final
-- operator-facing vocabulary. Convert them explicitly while retaining both old
-- enum values for rollback/compatibility with an older application binary.
UPDATE "OrganizationMembership"
SET "role" = 'EDITOR'
WHERE "role" = 'MANAGER';

UPDATE "OrganizationMembership"
SET "role" = 'VIEWER'
WHERE "role" = 'MEMBER';

CREATE TABLE "OrganizationInvitation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "emailNormalized" VARCHAR(320) NOT NULL,
  "intendedRole" "OrganizationMembershipRole" NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "invitedByUserId" TEXT NOT NULL,
  "status" "OrganizationInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationOwnershipTransfer" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "initiatedByUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "status" "OrganizationOwnershipTransferStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganizationOwnershipTransfer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationOwnershipTransfer_distinct_users_check"
    CHECK ("initiatedByUserId" <> "targetUserId")
);

CREATE TABLE "OrganizationVerificationRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "submittedByUserId" TEXT NOT NULL,
  "status" "OrganizationVerificationRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "legalNameSnapshot" VARCHAR(200) NOT NULL,
  "registrationNumber" VARCHAR(160),
  "registrationCountryId" TEXT NOT NULL,
  "authorityDescription" VARCHAR(1200) NOT NULL,
  "officialWebsite" VARCHAR(500),
  "publicContactEmail" VARCHAR(320) NOT NULL,
  "reviewerUserId" TEXT,
  "reviewerNote" VARCHAR(2000),
  "userVisibleResponse" VARCHAR(1200),
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganizationVerificationRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationVerificationDocument" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "type" "OrganizationVerificationDocumentType" NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrganizationVerificationDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationSlugAlias" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "slug" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrganizationSlugAlias_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AuditLog"
  ADD COLUMN "organizationId" TEXT;

CREATE UNIQUE INDEX "Organization_coverMediaId_key"
  ON "Organization"("coverMediaId");
CREATE INDEX "Organization_type_lifecycleStatus_createdAt_idx"
  ON "Organization"("type", "lifecycleStatus", "createdAt");
CREATE INDEX "Organization_isOfficialPartner_lifecycleStatus_idx"
  ON "Organization"("isOfficialPartner", "lifecycleStatus");
CREATE INDEX "OrganizationMembership_removedById_removedAt_idx"
  ON "OrganizationMembership"("removedById", "removedAt");
CREATE UNIQUE INDEX "OrganizationInvitation_tokenHash_key"
  ON "OrganizationInvitation"("tokenHash");
CREATE INDEX "OrganizationInvitation_organizationId_status_createdAt_idx"
  ON "OrganizationInvitation"("organizationId", "status", "createdAt");
CREATE INDEX "OrganizationInvitation_emailNormalized_status_expiresAt_idx"
  ON "OrganizationInvitation"("emailNormalized", "status", "expiresAt");
CREATE INDEX "OrganizationInvitation_expiresAt_status_idx"
  ON "OrganizationInvitation"("expiresAt", "status");
CREATE UNIQUE INDEX "OrganizationInvitation_one_pending_email"
  ON "OrganizationInvitation"("organizationId", "emailNormalized")
  WHERE "status" = 'PENDING';
CREATE INDEX "OrganizationOwnershipTransfer_organizationId_status_created_idx"
  ON "OrganizationOwnershipTransfer"("organizationId", "status", "createdAt");
CREATE INDEX "OrganizationOwnershipTransfer_targetUserId_status_expiresAt_idx"
  ON "OrganizationOwnershipTransfer"("targetUserId", "status", "expiresAt");
CREATE INDEX "OrganizationOwnershipTransfer_expiresAt_status_idx"
  ON "OrganizationOwnershipTransfer"("expiresAt", "status");
CREATE UNIQUE INDEX "OrganizationOwnershipTransfer_one_pending_per_org"
  ON "OrganizationOwnershipTransfer"("organizationId")
  WHERE "status" = 'PENDING';
CREATE INDEX "OrganizationVerificationRequest_organizationId_status_creat_idx"
  ON "OrganizationVerificationRequest"("organizationId", "status", "createdAt");
CREATE INDEX "OrganizationVerificationRequest_status_submittedAt_idx"
  ON "OrganizationVerificationRequest"("status", "submittedAt");
CREATE INDEX "OrganizationVerificationRequest_reviewerUserId_status_updat_idx"
  ON "OrganizationVerificationRequest"("reviewerUserId", "status", "updatedAt");
CREATE INDEX "OrganizationVerificationRequest_registrationCountryId_statu_idx"
  ON "OrganizationVerificationRequest"("registrationCountryId", "status");
CREATE UNIQUE INDEX "OrganizationVerificationRequest_one_open_per_org"
  ON "OrganizationVerificationRequest"("organizationId")
  WHERE "status" IN (
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'MORE_INFORMATION_REQUIRED'
  );
CREATE UNIQUE INDEX "OrganizationVerificationDocument_mediaId_key"
  ON "OrganizationVerificationDocument"("mediaId");
CREATE INDEX "OrganizationVerificationDocument_requestId_createdAt_idx"
  ON "OrganizationVerificationDocument"("requestId", "createdAt");
CREATE UNIQUE INDEX "OrganizationSlugAlias_slug_key"
  ON "OrganizationSlugAlias"("slug");
CREATE INDEX "OrganizationSlugAlias_organizationId_createdAt_idx"
  ON "OrganizationSlugAlias"("organizationId", "createdAt");
CREATE INDEX "AuditLog_organizationId_createdAt_idx"
  ON "AuditLog"("organizationId", "createdAt");

ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_coverMediaId_fkey"
  FOREIGN KEY ("coverMediaId") REFERENCES "MediaAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_partnerGrantedById_fkey"
  FOREIGN KEY ("partnerGrantedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership"
  ADD CONSTRAINT "OrganizationMembership_removedById_fkey"
  FOREIGN KEY ("removedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvitation"
  ADD CONSTRAINT "OrganizationInvitation_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvitation"
  ADD CONSTRAINT "OrganizationInvitation_invitedByUserId_fkey"
  FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationOwnershipTransfer"
  ADD CONSTRAINT "OrganizationOwnershipTransfer_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationOwnershipTransfer"
  ADD CONSTRAINT "OrganizationOwnershipTransfer_initiatedByUserId_fkey"
  FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationOwnershipTransfer"
  ADD CONSTRAINT "OrganizationOwnershipTransfer_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationVerificationRequest"
  ADD CONSTRAINT "OrganizationVerificationRequest_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationVerificationRequest"
  ADD CONSTRAINT "OrganizationVerificationRequest_submittedByUserId_fkey"
  FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationVerificationRequest"
  ADD CONSTRAINT "OrganizationVerificationRequest_registrationCountryId_fkey"
  FOREIGN KEY ("registrationCountryId") REFERENCES "Country"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationVerificationRequest"
  ADD CONSTRAINT "OrganizationVerificationRequest_reviewerUserId_fkey"
  FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationVerificationDocument"
  ADD CONSTRAINT "OrganizationVerificationDocument_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "OrganizationVerificationRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationVerificationDocument"
  ADD CONSTRAINT "OrganizationVerificationDocument_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationSlugAlias"
  ADD CONSTRAINT "OrganizationSlugAlias_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "NotificationTemplate" (
  "key",
  "type",
  "titleTemplate",
  "bodyTemplate",
  "isActive",
  "version",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    'ORGANIZATION_INVITATION',
    'ACCOUNT',
    'Organization invitation',
    'You were invited to join {{organizationName}} as {{role}}.',
    true,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'ORGANIZATION_INVITATION_ACCEPTED',
    'ACCOUNT',
    'New organization teammate',
    '{{actorName}} joined {{organizationName}}.',
    true,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'ORGANIZATION_ROLE_CHANGED',
    'ACCOUNT',
    'Organization role updated',
    'Your role at {{organizationName}} is now {{role}}.',
    true,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'ORGANIZATION_MEMBER_REMOVED',
    'ACCOUNT',
    'Organization access changed',
    'Your access to {{organizationName}} was removed.',
    true,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'ORGANIZATION_OWNERSHIP_TRANSFER',
    'ACCOUNT',
    'Ownership transfer update',
    '{{organizationName}} ownership: {{outcome}}.',
    true,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'ORGANIZATION_VERIFICATION_UPDATE',
    'MODERATION_UPDATE',
    'Organization verification update',
    '{{organizationName}} verification: {{outcome}}.',
    true,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'ORGANIZATION_STATUS_UPDATE',
    'MODERATION_UPDATE',
    'Organization status update',
    '{{organizationName}}: {{outcome}}.',
    true,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("key") DO NOTHING;
