ALTER TABLE "Community"
ADD COLUMN "searchVector" tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce("name", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("description", '')), 'B')
) STORED;

CREATE INDEX "Community_searchVector_idx" ON "Community" USING GIN ("searchVector");

ALTER TABLE "MarketplaceListing"
ADD COLUMN "searchVector" tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("description", '')), 'B')
) STORED;

CREATE INDEX "MarketplaceListing_searchVector_idx" ON "MarketplaceListing" USING GIN ("searchVector");

ALTER TABLE "Guide"
ADD COLUMN "searchVector" tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("summary", '')), 'B')
) STORED;

CREATE INDEX "Guide_searchVector_idx" ON "Guide" USING GIN ("searchVector");

ALTER TABLE "Question"
ADD COLUMN "searchVector" tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("body", '')), 'B')
) STORED;

CREATE INDEX "Question_searchVector_idx" ON "Question" USING GIN ("searchVector");

ALTER TABLE "Post"
ADD COLUMN "searchVector" tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("content", '')), 'B')
) STORED;

CREATE INDEX "Post_searchVector_idx" ON "Post" USING GIN ("searchVector");

ALTER TABLE "User"
ADD COLUMN "searchVector" tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce("firstName", '') || ' ' || coalesce("lastName", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("degree", '')), 'B')
) STORED;

CREATE INDEX "User_searchVector_idx" ON "User" USING GIN ("searchVector");
