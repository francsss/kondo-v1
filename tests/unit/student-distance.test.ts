import { describe, expect, it } from "vitest";
import {
  CITY_COORDINATES,
  UNIVERSITY_COORDINATES,
} from "@/lib/place-coordinates";
import {
  distanceLabel,
  haversineKilometres,
  studentDistanceKilometres,
  studyPoint,
  toPoint,
} from "@/lib/student-distance";

describe("haversine distance", () => {
  it("measures a known campus pair correctly", () => {
    // Peking and Tsinghua are neighbours in Haidian, roughly 2 km apart.
    const distance = haversineKilometres(
      UNIVERSITY_COORDINATES["Peking University"]!,
      UNIVERSITY_COORDINATES["Tsinghua University"]!,
    );
    expect(distance).toBeGreaterThan(1.5);
    expect(distance).toBeLessThan(2.5);
  });

  it("measures a known city pair correctly", () => {
    // Beijing to Shanghai is about 1070 km.
    const distance = haversineKilometres(
      CITY_COORDINATES.Beijing!,
      CITY_COORDINATES.Shanghai!,
    );
    expect(distance).toBeGreaterThan(1000);
    expect(distance).toBeLessThan(1150);
  });

  it("is zero for a point against itself, and symmetric", () => {
    const beijing = CITY_COORDINATES.Beijing!;
    const wuhan = CITY_COORDINATES.Wuhan!;
    expect(haversineKilometres(beijing, beijing)).toBe(0);
    expect(haversineKilometres(beijing, wuhan)).toBeCloseTo(
      haversineKilometres(wuhan, beijing),
      6,
    );
  });
});

describe("distance labels", () => {
  it("rounds to whole kilometres", () => {
    expect(distanceLabel(4.63)).toBe("5 km away");
    expect(distanceLabel(2.1)).toBe("2 km away");
    expect(distanceLabel(11.7)).toBe("12 km away");
  });

  it("never exposes a sub-kilometre figure", () => {
    expect(distanceLabel(0.9)).toBe("< 1 km away");
    expect(distanceLabel(0.02)).toBe("< 1 km away");
    expect(distanceLabel(0)).toBe("< 1 km away");
  });

  it("says nothing when there is nothing to say", () => {
    expect(distanceLabel(null)).toBeNull();
    expect(distanceLabel(Number.NaN)).toBeNull();
    expect(distanceLabel(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("never emits decimals or metres", () => {
    for (const kilometres of [0.4, 1.2, 3.55, 9.99, 48.2, 1234.5]) {
      const label = distanceLabel(kilometres)!;
      expect(label).not.toMatch(/\d+\.\d/);
      expect(label).toMatch(/^(< 1|\d+) km away$/);
    }
  });
});

describe("study points", () => {
  it("prefers the campus over the city", () => {
    const point = studyPoint({
      universityLatitude: 39.999,
      universityLongitude: 116.3059,
      cityLatitude: 39.9042,
      cityLongitude: 116.4074,
    });
    expect(point).toEqual({ latitude: 39.999, longitude: 116.3059 });
  });

  it("falls back to the city when the campus is unmapped", () => {
    const point = studyPoint({
      universityLatitude: null,
      universityLongitude: null,
      cityLatitude: 30.5928,
      cityLongitude: 114.3055,
    });
    expect(point).toEqual({ latitude: 30.5928, longitude: 114.3055 });
  });

  it("is null when neither place is mapped", () => {
    expect(
      studyPoint({
        universityLatitude: null,
        universityLongitude: null,
        cityLatitude: null,
        cityLongitude: null,
      }),
    ).toBeNull();
  });

  it("rejects null island and out-of-range values", () => {
    expect(toPoint(0, 0)).toBeNull();
    expect(toPoint(91, 10)).toBeNull();
    expect(toPoint(10, 181)).toBeNull();
    expect(toPoint("not a number", 10)).toBeNull();
  });

  it("accepts the string form Prisma decimals arrive in", () => {
    expect(toPoint("39.999000", "116.305900")).toEqual({
      latitude: 39.999,
      longitude: 116.3059,
    });
  });
});

describe("student distance", () => {
  it("is null when either student's place is unknown", () => {
    const beijing = CITY_COORDINATES.Beijing!;
    expect(studentDistanceKilometres(null, beijing)).toBeNull();
    expect(studentDistanceKilometres(beijing, null)).toBeNull();
  });

  it("produces the same answer every time for the same pair", () => {
    const first = studentDistanceKilometres(
      UNIVERSITY_COORDINATES["Wuhan University"]!,
      UNIVERSITY_COORDINATES["Zhejiang University"]!,
    );
    const second = studentDistanceKilometres(
      UNIVERSITY_COORDINATES["Wuhan University"]!,
      UNIVERSITY_COORDINATES["Zhejiang University"]!,
    );
    expect(first).toBe(second);
  });
});

describe("place reference data", () => {
  it("holds only plausible coordinates", () => {
    for (const [name, point] of [
      ...Object.entries(CITY_COORDINATES),
      ...Object.entries(UNIVERSITY_COORDINATES),
    ]) {
      expect(point.latitude, name).toBeGreaterThan(-90);
      expect(point.latitude, name).toBeLessThan(90);
      expect(point.longitude, name).toBeGreaterThan(-180);
      expect(point.longitude, name).toBeLessThan(180);
    }
  });

  it("places every university within 120 km of a known city", () => {
    // Catches a transposed or mistyped coordinate: a campus should never be
    // hundreds of kilometres from every city Kondo knows.
    const cities = Object.values(CITY_COORDINATES);
    for (const [name, campus] of Object.entries(UNIVERSITY_COORDINATES)) {
      const nearest = Math.min(
        ...cities.map((city) => haversineKilometres(campus, city)),
      );
      expect(nearest, name).toBeLessThan(120);
    }
  });
});
