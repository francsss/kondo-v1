-- Where in the book a note was taken, in words.
--
-- `locator` already says where precisely, but a CFI is not something a student
-- can read. An EPUB has no chapter rows in the database — the sections live
-- inside the file — so the chapter's own label is recorded on the note at the
-- moment it is written. Additive and nullable: every existing note keeps
-- working, and a note taken without a resolvable chapter simply has none.
ALTER TABLE "StudyNote" ADD COLUMN IF NOT EXISTS "chapterLabel" VARCHAR(300);
