UPDATE "User"
SET
  "officialProfileStatus" = 'APPROVED',
  "officialOrganizationType" = 'ADMINISTRATOR',
  "officialOrganizationName" = 'Kondo Administrator',
  "officialVerifiedAt" = COALESCE("officialVerifiedAt", CURRENT_TIMESTAMP)
WHERE
  "role" IN ('ADMIN', 'SUPER_ADMIN')
  AND "officialProfileStatus" = 'NOT_VERIFIED';
