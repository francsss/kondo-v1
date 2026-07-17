CREATE TYPE "CommunityStatus" AS ENUM (
  'PENDING_REVIEW',
  'ACTIVE',
  'ARCHIVED',
  'REMOVED'
);

CREATE TYPE "CommunityJoinPolicy" AS ENUM (
  'OPEN',
  'REQUEST',
  'INVITE_ONLY'
);

CREATE TYPE "CommunityAccessType" AS ENUM (
  'JOIN_REQUEST',
  'INVITATION'
);

CREATE TYPE "CommunityAccessStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

ALTER TABLE "Community"
ADD COLUMN "status" "CommunityStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "joinPolicy" "CommunityJoinPolicy" NOT NULL DEFAULT 'OPEN',
ADD COLUMN "coverMediaId" TEXT,
ADD COLUMN "ownerId" TEXT,
ADD COLUMN "moderatedAt" TIMESTAMP(3),
ADD COLUMN "removedAt" TIMESTAMP(3);

UPDATE "Community"
SET "ownerId" = "createdById";

ALTER TABLE "Community"
ALTER COLUMN "ownerId" SET NOT NULL;

-- Normalize the current creator as the single operational owner.
UPDATE "CommunityMember" AS membership
SET "role" = 'MODERATOR'
FROM "Community" AS community
WHERE
  membership."communityId" = community."id"
  AND membership."role" = 'OWNER'
  AND membership."userId" <> community."createdById";

INSERT INTO "CommunityMember" (
  "id",
  "communityId",
  "userId",
  "role",
  "joinedAt"
)
SELECT
  'owner-' || community."id",
  community."id",
  community."createdById",
  'OWNER',
  community."createdAt"
FROM "Community" AS community
ON CONFLICT ("communityId", "userId")
DO UPDATE SET "role" = 'OWNER';

CREATE TABLE "CommunityAccessRequest" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdById" TEXT,
  "resolvedById" TEXT,
  "type" "CommunityAccessType" NOT NULL,
  "status" "CommunityAccessStatus" NOT NULL DEFAULT 'PENDING',
  "note" VARCHAR(500),
  "resolution" VARCHAR(500),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommunityAccessRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Post"
ADD COLUMN "eventEndsAt" TIMESTAMP(3),
ADD COLUMN "eventCapacity" INTEGER,
ADD COLUMN "eventValidatedAt" TIMESTAMP(3),
ADD COLUMN "removedAt" TIMESTAMP(3);

UPDATE "Post"
SET "eventValidatedAt" = COALESCE("eventAt", "createdAt")
WHERE "type" = 'EVENT' AND "status" = 'PUBLISHED';

ALTER TABLE "Post"
ADD CONSTRAINT "Post_event_capacity_check"
CHECK ("eventCapacity" IS NULL OR "eventCapacity" > 0);

ALTER TABLE "Post"
ADD CONSTRAINT "Post_event_dates_check"
CHECK (
  "eventEndsAt" IS NULL
  OR ("eventAt" IS NOT NULL AND "eventEndsAt" >= "eventAt")
);

CREATE TABLE "PostMedia" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PostMedia_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Comment"
ADD COLUMN "removedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Community_coverMediaId_key"
ON "Community"("coverMediaId");

CREATE INDEX "Community_status_isPrivate_createdAt_idx"
ON "Community"("status", "isPrivate", "createdAt");

CREATE INDEX "Community_ownerId_status_idx"
ON "Community"("ownerId", "status");

CREATE UNIQUE INDEX "CommunityMember_one_owner_key"
ON "CommunityMember"("communityId")
WHERE "role" = 'OWNER';

CREATE INDEX "CommunityMember_communityId_role_joinedAt_idx"
ON "CommunityMember"("communityId", "role", "joinedAt");

CREATE UNIQUE INDEX "CommunityAccessRequest_communityId_userId_type_key"
ON "CommunityAccessRequest"("communityId", "userId", "type");

CREATE INDEX "CommunityAccessRequest_communityId_status_createdAt_idx"
ON "CommunityAccessRequest"("communityId", "status", "createdAt");

CREATE INDEX "CommunityAccessRequest_userId_status_createdAt_idx"
ON "CommunityAccessRequest"("userId", "status", "createdAt");

CREATE INDEX "Post_communityId_type_eventValidatedAt_eventAt_idx"
ON "Post"("communityId", "type", "eventValidatedAt", "eventAt");

CREATE UNIQUE INDEX "PostMedia_mediaId_key"
ON "PostMedia"("mediaId");

CREATE UNIQUE INDEX "PostMedia_postId_order_key"
ON "PostMedia"("postId", "order");

CREATE INDEX "PostMedia_postId_order_idx"
ON "PostMedia"("postId", "order");

CREATE UNIQUE INDEX "Report_active_community_content_key"
ON "Report"("reporterId", "targetType", "targetId")
WHERE
  "reporterId" IS NOT NULL
  AND "targetType" IN ('Community', 'Post', 'Comment')
  AND "status" IN ('OPEN', 'REVIEWING');

ALTER TABLE "Community"
ADD CONSTRAINT "Community_coverMediaId_fkey"
FOREIGN KEY ("coverMediaId") REFERENCES "MediaAsset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Community"
ADD CONSTRAINT "Community_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CommunityAccessRequest"
ADD CONSTRAINT "CommunityAccessRequest_communityId_fkey"
FOREIGN KEY ("communityId") REFERENCES "Community"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityAccessRequest"
ADD CONSTRAINT "CommunityAccessRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityAccessRequest"
ADD CONSTRAINT "CommunityAccessRequest_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommunityAccessRequest"
ADD CONSTRAINT "CommunityAccessRequest_resolvedById_fkey"
FOREIGN KEY ("resolvedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PostMedia"
ADD CONSTRAINT "PostMedia_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "Post"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostMedia"
ADD CONSTRAINT "PostMedia_mediaId_fkey"
FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- The owner must be the community's OWNER membership. The deferred composite
-- foreign key allows create and transfer operations to update both rows in one
-- transaction without exposing an ownerless intermediate state.
ALTER TABLE "Community"
ADD CONSTRAINT "Community_owner_membership_fkey"
FOREIGN KEY ("id", "ownerId")
REFERENCES "CommunityMember"("communityId", "userId")
DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION "enforce_community_owner_role"()
RETURNS trigger AS $$
DECLARE
  target_community_id TEXT;
  target_owner_id TEXT;
  owner_role "MembershipRole";
BEGIN
  IF TG_TABLE_NAME = 'Community' THEN
    target_community_id := NEW."id";
    target_owner_id := NEW."ownerId";
  ELSIF TG_OP = 'DELETE' THEN
    target_community_id := OLD."communityId";
    SELECT "ownerId"
    INTO target_owner_id
    FROM "Community"
    WHERE "id" = target_community_id;
  ELSE
    target_community_id := NEW."communityId";
    SELECT "ownerId"
    INTO target_owner_id
    FROM "Community"
    WHERE "id" = target_community_id;
  END IF;

  IF target_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT "role"
  INTO owner_role
  FROM "CommunityMember"
  WHERE
    "communityId" = target_community_id
    AND "userId" = target_owner_id;

  IF owner_role IS DISTINCT FROM 'OWNER'::"MembershipRole" THEN
    RAISE EXCEPTION
      'Community % owner must have OWNER membership',
      target_community_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "Community_owner_role_trigger"
AFTER INSERT OR UPDATE OF "ownerId" ON "Community"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_community_owner_role"();

CREATE CONSTRAINT TRIGGER "CommunityMember_owner_role_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "CommunityMember"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_community_owner_role"();
