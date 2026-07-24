-- Extend the existing secure-media constraint to the VIDEO kind introduced
-- for Student Stories. Active videos require verified duration metadata.
ALTER TABLE "MediaAsset"
  DROP CONSTRAINT IF EXISTS "MediaAsset_dimensions_check";

ALTER TABLE "MediaAsset"
  ADD CONSTRAINT "MediaAsset_dimensions_check" CHECK (
    (
      "kind" = 'DOCUMENT'
      AND "width" IS NULL
      AND "height" IS NULL
      AND "durationSeconds" IS NULL
    )
    OR
    (
      "kind" = 'IMAGE'
      AND "durationSeconds" IS NULL
      AND (
        "status" <> 'ACTIVE'
        OR ("width" IS NOT NULL AND "height" IS NOT NULL)
      )
    )
    OR
    (
      "kind" = 'VIDEO'
      AND "width" IS NULL
      AND "height" IS NULL
      AND (
        "status" <> 'ACTIVE'
        OR ("durationSeconds" IS NOT NULL AND "durationSeconds" > 0)
      )
    )
  );
