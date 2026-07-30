-- PostgreSQL requires ALTER TYPE ... ADD VALUE to commit before a later
-- transaction can safely use the new values in data migrations.

ALTER TYPE "OrganizationVerificationStatus"
  ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE "OrganizationVerificationStatus"
  ADD VALUE IF NOT EXISTS 'REVOKED';
ALTER TYPE "OrganizationMembershipRole"
  ADD VALUE IF NOT EXISTS 'EDITOR';
ALTER TYPE "OrganizationMembershipRole"
  ADD VALUE IF NOT EXISTS 'VIEWER';
ALTER TYPE "MediaPurpose"
  ADD VALUE IF NOT EXISTS 'ORGANIZATION_COVER';
ALTER TYPE "MediaPurpose"
  ADD VALUE IF NOT EXISTS 'ORGANIZATION_VERIFICATION_DOCUMENT';
