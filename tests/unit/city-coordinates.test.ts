import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The coordinate backfills are data, and wrong data here is worse than none:
 * a transposed latitude and longitude, or a dropped minus sign, produces a
 * distance that looks exactly as real as a correct one. Nearby has no way to
 * tell the difference, and neither does the student reading it.
 *
 * So the migrations are parsed and every value checked. This cannot prove a
 * city is where the file says it is, but it catches the mistakes that make a
 * coordinate table silently useless.
 */

const MIGRATIONS = [
  "20260815213000_place_coordinates_backfill",
  "20260816180000_city_coordinates_backfill_2",
];

/** Mainland China, generously bounded. */
const CHINA = { minLat: 17.5, maxLat: 54.0, minLng: 73.0, maxLng: 135.5 };

type Row = { table: string; name: string; latitude: number; longitude: number };

function rows(): Row[] {
  const parsed: Row[] = [];
  for (const migration of MIGRATIONS) {
    const sql = readFileSync(
      new URL(
        `../../prisma/migrations/${migration}/migration.sql`,
        import.meta.url,
      ),
      "utf8",
    );
    const pattern =
      /UPDATE "(City|University)" SET "latitude" = (-?[\d.]+), "longitude" = (-?[\d.]+) WHERE "name" = '((?:[^']|'')*)'/g;
    for (const match of sql.matchAll(pattern)) {
      parsed.push({
        table: match[1],
        latitude: Number(match[2]),
        longitude: Number(match[3]),
        name: match[4].replaceAll("''", "'"),
      });
    }
  }
  return parsed;
}

describe("place coordinate backfills", () => {
  const all = rows();

  it("parses a substantial number of places", () => {
    // Guards against the regex silently matching nothing after a reformat.
    expect(all.length).toBeGreaterThan(300);
  });

  it("places every coordinate inside China", () => {
    for (const row of all) {
      expect(row.latitude, row.name).toBeGreaterThanOrEqual(CHINA.minLat);
      expect(row.latitude, row.name).toBeLessThanOrEqual(CHINA.maxLat);
      expect(row.longitude, row.name).toBeGreaterThanOrEqual(CHINA.minLng);
      expect(row.longitude, row.name).toBeLessThanOrEqual(CHINA.maxLng);
    }
  });

  it("never transposes latitude and longitude", () => {
    for (const row of all) {
      // Every longitude in China exceeds every latitude in China, so a swap
      // is detectable without knowing where the place actually is.
      expect(row.longitude, row.name).toBeGreaterThan(row.latitude);
    }
  });

  it("uses a precision the data actually supports", () => {
    for (const row of all) {
      const decimals = (value: number) =>
        (String(value).split(".")[1] ?? "").length;
      // Six decimals is ~10 cm. A city centroid does not know that.
      expect(decimals(row.latitude), row.name).toBeLessThanOrEqual(4);
      expect(decimals(row.longitude), row.name).toBeLessThanOrEqual(4);
    }
  });

  it("writes each place at most once per table", () => {
    const seen = new Set<string>();
    for (const row of all) {
      const key = `${row.table}:${row.name}`;
      // A second UPDATE for the same name is dead: the first one filled the
      // NULL the second one requires.
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });

  it("only writes rows that are still empty, so re-running is a no-op", () => {
    for (const migration of MIGRATIONS) {
      const sql = readFileSync(
        new URL(
          `../../prisma/migrations/${migration}/migration.sql`,
          import.meta.url,
        ),
        "utf8",
      );
      const updates = sql
        .split("\n")
        .filter((line) => line.startsWith("UPDATE "));
      for (const line of updates) {
        expect(line, migration).toContain('"latitude" IS NULL');
        expect(line, migration).toContain('"longitude" IS NULL');
      }
    }
  });
});
