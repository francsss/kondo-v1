-- Tie editorial city workspaces to the reference city selected by members.
-- The field remains nullable only for legacy hubs that cannot be matched
-- safely; all new hubs are created from an eligible City record.
ALTER TABLE "CityHub" ADD COLUMN "cityId" TEXT;

UPDATE "CityHub" AS hub
SET "cityId" = city.id
FROM "City" AS city
INNER JOIN "Country" AS country ON country.id = city."countryId"
WHERE country.code = 'CN'
  AND LOWER(city.name) = LOWER(hub.name)
  AND hub.id = (
    SELECT candidate.id
    FROM "CityHub" AS candidate
    WHERE LOWER(candidate.name) = LOWER(city.name)
    ORDER BY candidate."createdAt" ASC, candidate.id ASC
    LIMIT 1
  );

CREATE UNIQUE INDEX "CityHub_cityId_key" ON "CityHub"("cityId");

ALTER TABLE "CityHub"
ADD CONSTRAINT "CityHub_cityId_fkey"
FOREIGN KEY ("cityId") REFERENCES "City"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
