-- Add operational lifecycle fields to normalized reference data.
ALTER TABLE "Country"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "City"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "University"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Existing seeded reference data was reviewed for the MVP.
UPDATE "Country" SET "verified" = true;
UPDATE "City" SET "verified" = true;

-- Normalize redundant University.countryId from its canonical City relation.
UPDATE "University" AS university
SET "countryId" = city."countryId"
FROM "City" AS city
WHERE university."cityId" = city."id"
  AND university."countryId" IS DISTINCT FROM city."countryId";

-- Correct historical user rows whose selected university belongs to another city.
UPDATE "User" AS member
SET "cityId" = university."cityId",
    "updatedAt" = CURRENT_TIMESTAMP
FROM "University" AS university
WHERE member."universityId" = university."id"
  AND member."cityId" IS DISTINCT FROM university."cityId";

CREATE INDEX "Country_isActive_name_idx"
ON "Country"("isActive", "name");

CREATE INDEX "City_countryId_isActive_name_idx"
ON "City"("countryId", "isActive", "name");

CREATE INDEX "University_cityId_isActive_verified_name_idx"
ON "University"("cityId", "isActive", "verified", "name");

-- A university must use the same country as its selected city.
CREATE FUNCTION "kondo_validate_university_location"()
RETURNS TRIGGER AS $$
DECLARE
  expected_country_id TEXT;
BEGIN
  SELECT "countryId"
  INTO expected_country_id
  FROM "City"
  WHERE "id" = NEW."cityId";

  IF expected_country_id IS NOT NULL
     AND NEW."countryId" IS DISTINCT FROM expected_country_id THEN
    RAISE EXCEPTION 'University country must match its city country.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "University_location_consistency"
BEFORE INSERT OR UPDATE OF "cityId", "countryId" ON "University"
FOR EACH ROW
EXECUTE FUNCTION "kondo_validate_university_location"();

-- A member with a university must use that university's city.
CREATE FUNCTION "kondo_validate_user_study_location"()
RETURNS TRIGGER AS $$
DECLARE
  expected_city_id TEXT;
BEGIN
  IF NEW."universityId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "cityId"
  INTO expected_city_id
  FROM "University"
  WHERE "id" = NEW."universityId";

  IF expected_city_id IS NOT NULL
     AND NEW."cityId" IS DISTINCT FROM expected_city_id THEN
    RAISE EXCEPTION 'User city must match the selected university city.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "User_study_location_consistency"
BEFORE INSERT OR UPDATE OF "cityId", "universityId" ON "User"
FOR EACH ROW
EXECUTE FUNCTION "kondo_validate_user_study_location"();

-- Country and city corrections cascade only through their derived reference fields.
CREATE FUNCTION "kondo_sync_city_country"()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "University"
  SET "countryId" = NEW."countryId",
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "cityId" = NEW."id"
    AND "countryId" IS DISTINCT FROM NEW."countryId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "City_country_reference_sync"
AFTER UPDATE OF "countryId" ON "City"
FOR EACH ROW
WHEN (OLD."countryId" IS DISTINCT FROM NEW."countryId")
EXECUTE FUNCTION "kondo_sync_city_country"();

CREATE FUNCTION "kondo_sync_university_city"()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "User"
  SET "cityId" = NEW."cityId",
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "universityId" = NEW."id"
    AND "cityId" IS DISTINCT FROM NEW."cityId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "University_city_user_sync"
AFTER UPDATE OF "cityId" ON "University"
FOR EACH ROW
WHEN (OLD."cityId" IS DISTINCT FROM NEW."cityId")
EXECUTE FUNCTION "kondo_sync_university_city"();
