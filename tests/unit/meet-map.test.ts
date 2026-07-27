import { describe, expect, it } from "vitest";
import {
  meetMapRadiusKm,
  meetMapSearchQuery,
  meetMapZoom,
  privacySafeMapCoordinate,
} from "@/lib/meet-map";

function approximateDistanceKm(
  first: { lng: number; lat: number },
  second: { lng: number; lat: number },
) {
  const latitudeKm = (second.lat - first.lat) * 111.32;
  const longitudeKm =
    (second.lng - first.lng) * 111.32 * Math.cos((first.lat * Math.PI) / 180);
  return Math.hypot(latitudeKm, longitudeKm);
}

describe("Meet privacy-safe real-map coordinates", () => {
  const jiaxingUniversity = { lng: 120.755, lat: 30.746 };

  it("creates deterministic approximate points inside the selected radius", () => {
    const first = privacySafeMapCoordinate(
      jiaxingUniversity,
      "profile-123",
      "KM_5",
    );
    const repeated = privacySafeMapCoordinate(
      jiaxingUniversity,
      "profile-123",
      "KM_5",
    );
    const other = privacySafeMapCoordinate(
      jiaxingUniversity,
      "profile-456",
      "KM_5",
    );

    expect(first).toEqual(repeated);
    expect(other).not.toEqual(first);
    expect(approximateDistanceKm(jiaxingUniversity, first)).toBeLessThan(5);
    expect(approximateDistanceKm(jiaxingUniversity, first)).toBeGreaterThan(
      0.5,
    );
  });

  it("uses public study-area labels rather than exact user coordinates", () => {
    expect(meetMapSearchQuery("Jiaxing University", "Jiaxing")).toBe(
      "Jiaxing University, Jiaxing, China",
    );
    expect(meetMapRadiusKm("KM_20")).toBe(20);
    expect(meetMapZoom("KM_5")).toBeGreaterThan(meetMapZoom("KM_20"));
  });
});
