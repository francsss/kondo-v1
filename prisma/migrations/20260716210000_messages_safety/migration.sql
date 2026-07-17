-- Add participant-scoped retention controls. Clearing a conversation never
-- destroys the shared message history or immutable report evidence.
ALTER TABLE "ConversationParticipant"
ADD COLUMN "clearedAt" TIMESTAMP(3),
ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Link validated Module 5 media to a single message while retaining the
-- historical provider-neutral attachment metadata during migration.
ALTER TABLE "Message"
ADD COLUMN "mediaId" TEXT;

CREATE UNIQUE INDEX "Message_mediaId_key" ON "Message"("mediaId");
CREATE INDEX "ConversationParticipant_userId_deletedAt_archivedAt_idx"
ON "ConversationParticipant"("userId", "deletedAt", "archivedAt");

ALTER TABLE "Message"
ADD CONSTRAINT "Message_mediaId_fkey"
FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Every stored message must contain text, validated media, or legacy attachment
-- metadata. New application writes use text and/or mediaId.
ALTER TABLE "Message"
ADD CONSTRAINT "Message_content_check"
CHECK (
  NULLIF(BTRIM("body"), '') IS NOT NULL
  OR "mediaId" IS NOT NULL
  OR "attachmentKey" IS NOT NULL
);

-- Earlier test and account-cleanup flows could leave empty DIRECT shells after
-- both users were physically deleted. They contain no member data or messages
-- and can be removed safely before enforcing the invariant.
DELETE FROM "Conversation" AS conversation
WHERE
  conversation."type" = 'DIRECT'
  AND NOT EXISTS (
    SELECT 1
    FROM "ConversationParticipant" AS participant
    WHERE participant."conversationId" = conversation."id"
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "Message" AS message
    WHERE message."conversationId" = conversation."id"
  );

-- Normalize existing canonical direct keys before enforcing the invariant.
UPDATE "Conversation" AS conversation
SET "directKey" = pairs."directKey"
FROM (
  SELECT
    participant."conversationId",
    MIN(participant."userId") || ':' || MAX(participant."userId") AS "directKey"
  FROM "ConversationParticipant" AS participant
  GROUP BY participant."conversationId"
  HAVING COUNT(*) = 2
) AS pairs
WHERE
  conversation."id" = pairs."conversationId"
  AND conversation."type" = 'DIRECT';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Conversation" AS conversation
    LEFT JOIN "ConversationParticipant" AS participant
      ON participant."conversationId" = conversation."id"
    WHERE conversation."type" = 'DIRECT'
    GROUP BY conversation."id", conversation."directKey"
    HAVING
      COUNT(participant."userId") <> 2
      OR conversation."directKey" IS NULL
      OR conversation."directKey" <>
        MIN(participant."userId") || ':' || MAX(participant."userId")
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce DIRECT cardinality: invalid legacy conversation detected';
  END IF;
END;
$$;

-- Validate DIRECT cardinality and canonical identity at transaction commit.
-- The trigger is deferred so Prisma can create the conversation and its two
-- nested participants atomically in either insert order.
CREATE OR REPLACE FUNCTION "enforce_direct_conversation_cardinality"()
RETURNS trigger AS $$
DECLARE
  target_id TEXT;
  conversation_type "ConversationType";
  direct_key TEXT;
  participant_ids TEXT[];
BEGIN
  IF TG_TABLE_NAME = 'Conversation' THEN
    target_id := COALESCE(NEW."id", OLD."id");
  ELSIF TG_OP = 'DELETE' THEN
    target_id := OLD."conversationId";
  ELSE
    target_id := NEW."conversationId";
  END IF;

  SELECT "type", "directKey"
  INTO conversation_type, direct_key
  FROM "Conversation"
  WHERE "id" = target_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF conversation_type = 'DIRECT' THEN
    SELECT ARRAY_AGG("userId" ORDER BY "userId")
    INTO participant_ids
    FROM "ConversationParticipant"
    WHERE "conversationId" = target_id;

    IF COALESCE(ARRAY_LENGTH(participant_ids, 1), 0) <> 2 THEN
      RAISE EXCEPTION 'DIRECT conversation % must have exactly two participants', target_id
        USING ERRCODE = '23514';
    END IF;

    IF direct_key IS NULL OR direct_key <> participant_ids[1] || ':' || participant_ids[2] THEN
      RAISE EXCEPTION 'DIRECT conversation % has a non-canonical directKey', target_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- A participant is never removed independently by Kondo. If a database-level
-- user deletion cascades into membership removal, delete the direct thread as
-- one unit so the database cannot retain a one-participant conversation.
CREATE OR REPLACE FUNCTION "delete_direct_conversation_after_participant_removal"()
RETURNS trigger AS $$
BEGIN
  DELETE FROM "Conversation"
  WHERE "id" = OLD."conversationId"
    AND "type" = 'DIRECT';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Reject a third participant (or a user not represented by directKey)
-- immediately. Creation of the first and second canonical participant remains
-- valid inside the transaction and the deferred trigger validates completion.
CREATE OR REPLACE FUNCTION "guard_direct_conversation_participant"()
RETURNS trigger AS $$
DECLARE
  conversation_type "ConversationType";
  direct_key TEXT;
  participant_count INTEGER;
BEGIN
  SELECT "type", "directKey"
  INTO conversation_type, direct_key
  FROM "Conversation"
  WHERE "id" = NEW."conversationId";

  IF conversation_type = 'DIRECT' THEN
    IF TG_OP = 'UPDATE' THEN
      SELECT COUNT(*)
      INTO participant_count
      FROM "ConversationParticipant"
      WHERE "conversationId" = NEW."conversationId"
        AND NOT (
          "conversationId" = OLD."conversationId"
          AND "userId" = OLD."userId"
        );
    ELSE
      SELECT COUNT(*)
      INTO participant_count
      FROM "ConversationParticipant"
      WHERE "conversationId" = NEW."conversationId";
    END IF;

    IF participant_count >= 2 THEN
      RAISE EXCEPTION
        'DIRECT conversation % must have exactly two participants',
        NEW."conversationId"
        USING ERRCODE = '23514';
    END IF;

    IF
      direct_key IS NULL
      OR (
        direct_key NOT LIKE NEW."userId" || ':%'
        AND direct_key NOT LIKE '%:' || NEW."userId"
      )
    THEN
      RAISE EXCEPTION
        'DIRECT participant is not represented by the canonical directKey'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ConversationParticipant_direct_guard_trigger"
BEFORE INSERT OR UPDATE OF "conversationId", "userId"
ON "ConversationParticipant"
FOR EACH ROW
EXECUTE FUNCTION "guard_direct_conversation_participant"();

CREATE TRIGGER "ConversationParticipant_direct_cleanup_trigger"
AFTER DELETE ON "ConversationParticipant"
FOR EACH ROW
EXECUTE FUNCTION "delete_direct_conversation_after_participant_removal"();

CREATE CONSTRAINT TRIGGER "Conversation_direct_cardinality_trigger"
AFTER INSERT OR UPDATE OF "type", "directKey" ON "Conversation"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_direct_conversation_cardinality"();

CREATE CONSTRAINT TRIGGER "ConversationParticipant_direct_cardinality_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "ConversationParticipant"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_direct_conversation_cardinality"();
