/**
 * Fill in coordinates for the cities and universities Kondo knows about.
 *
 * Idempotent and non-destructive: it only writes rows whose coordinates are
 * still null, so re-running it never disturbs a value someone has corrected,
 * and a place missing from the reference list is left alone rather than
 * guessed at.
 */
import { PrismaClient } from "@prisma/client";
import {
  CITY_COORDINATES,
  UNIVERSITY_COORDINATES,
} from "../src/lib/place-coordinates.ts";

const prisma = new PrismaClient();

async function backfill(model, table, reference) {
  let updated = 0;
  for (const [name, point] of Object.entries(reference)) {
    const result = await prisma[model].updateMany({
      where: { name, latitude: null, longitude: null },
      data: { latitude: point.latitude, longitude: point.longitude },
    });
    updated += result.count;
  }
  const withCoordinates = await prisma[model].count({
    where: { latitude: { not: null } },
  });
  const total = await prisma[model].count();
  console.log(
    `${table}: ${updated} updated, ${withCoordinates}/${total} now have coordinates`,
  );
}

await backfill("city", "City", CITY_COORDINATES);
await backfill("university", "University", UNIVERSITY_COORDINATES);
await prisma.$disconnect();
