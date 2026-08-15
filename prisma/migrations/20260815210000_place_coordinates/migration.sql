-- Coordinates for the places students study in.
--
-- Nearby has to show how far away another student is, and Kondo stored no
-- coordinates for anything a person is attached to: `User` has a city, a
-- university and a country, and the only latitude/longitude columns in the
-- schema belong to `HousingListing`. Without this there is no honest distance
-- to compute, and the surface this replaced filled that gap by hashing a
-- profile ID into a fake point near a campus.
--
-- These are the published locations of institutions and cities, not people.
-- A student's position is never stored or derived from a device; the distance
-- between two students is the distance between the places they study, which is
-- what "5 km away" should mean on a student network anyway.
--
-- Additive and nullable: every existing row stays valid, and a place without
-- coordinates simply yields no distance rather than a wrong one.

ALTER TABLE "City"
  ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(9, 6),
  ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(9, 6);

ALTER TABLE "University"
  ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(9, 6),
  ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(9, 6);

-- Partial indexes: only rows that actually carry coordinates are worth
-- indexing, and those are the only rows Nearby reads for distance.
CREATE INDEX IF NOT EXISTS "City_coordinates_idx"
  ON "City" ("latitude", "longitude")
  WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "University_coordinates_idx"
  ON "University" ("latitude", "longitude")
  WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;
