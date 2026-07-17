-- A deferred constraint-trigger failure can be reported by some Prisma/Postgres
-- combinations only after the interactive transaction callback has returned.
-- Protect the currently referenced owner synchronously so forbidden member
-- mutations fail explicitly while retaining the deferred cross-row invariant
-- needed by community creation and ownership transfer.
DROP TRIGGER IF EXISTS "CommunityMember_owner_role_trigger"
ON "CommunityMember";

CREATE OR REPLACE FUNCTION "protect_current_community_owner_membership"()
RETURNS trigger AS $$
DECLARE
  current_owner_id TEXT;
BEGIN
  SELECT "ownerId"
  INTO current_owner_id
  FROM "Community"
  WHERE "id" = OLD."communityId";

  IF
    current_owner_id = OLD."userId"
    AND (
      TG_OP = 'DELETE'
      OR NEW."communityId" IS DISTINCT FROM OLD."communityId"
      OR NEW."userId" IS DISTINCT FROM OLD."userId"
      OR NEW."role" IS DISTINCT FROM 'OWNER'::"MembershipRole"
    )
  THEN
    RAISE EXCEPTION
      'Community % owner must have OWNER membership',
      OLD."communityId"
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CommunityMember_protect_current_owner_trigger"
BEFORE UPDATE OR DELETE ON "CommunityMember"
FOR EACH ROW
EXECUTE FUNCTION "protect_current_community_owner_membership"();
