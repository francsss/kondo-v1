ALTER TABLE "Guide"
ADD COLUMN "coverMediaId" TEXT;

CREATE UNIQUE INDEX "Guide_coverMediaId_key"
ON "Guide"("coverMediaId");

ALTER TABLE "Guide"
ADD CONSTRAINT "Guide_coverMediaId_fkey"
FOREIGN KEY ("coverMediaId") REFERENCES "MediaAsset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
