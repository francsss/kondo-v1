import { describe, expect, it } from "vitest";
import {
  chinaCityNativeName,
  chinaUniversityNativeName,
} from "@/lib/china-map-aliases";
import {
  meetMapCityQueries,
  meetMapKnownAnchor,
  meetMapRadiusKm,
  meetMapSearchQueries,
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

  it("places two nearby students at distinct privacy-safe points within 5 km", () => {
    const students = ["jiaxing-student-one", "jiaxing-student-two"].map(
      (profileId) =>
        privacySafeMapCoordinate(jiaxingUniversity, profileId, "KM_5"),
    );

    expect(students[0]).not.toEqual(students[1]);
    expect(
      students.every(
        (coordinate) =>
          approximateDistanceKm(jiaxingUniversity, coordinate) < 5,
      ),
    ).toBe(true);
  });

  it("uses the verified Jiaxing study-area anchor without another network lookup", () => {
    expect(
      meetMapKnownAnchor([
        "嘉兴市嘉兴大学",
        "嘉兴大学",
        "Jiaxing University, Jiaxing, China",
      ]),
    ).toEqual(jiaxingUniversity);
  });

  it("uses public study-area labels rather than exact user coordinates", () => {
    expect(meetMapSearchQuery("Jiaxing University", "Jiaxing")).toBe(
      "Jiaxing University, Jiaxing, China",
    );
    expect(meetMapRadiusKm("KM_20")).toBe(20);
    expect(meetMapZoom("KM_5")).toBeGreaterThan(meetMapZoom("KM_20"));
  });

  it("prioritizes Baidu-native place names and keeps English fallbacks", () => {
    expect(
      chinaUniversityNativeName(
        "cuniversityf8a15c9ced43e971f975",
        "Jiaxing University",
      ),
    ).toBe("嘉兴大学");
    expect(chinaCityNativeName("ccity351267ac91b3d8719020", "Jiaxing")).toBe(
      "嘉兴市",
    );
    expect(
      meetMapSearchQueries({
        universityName: "Jiaxing University · Jiaxing",
        universityNativeName: "嘉兴大学",
        cityName: "Jiaxing, China",
        cityNativeName: "嘉兴市",
      }),
    ).toEqual([
      "嘉兴市嘉兴大学",
      "嘉兴大学",
      "Jiaxing University, Jiaxing, China",
      "Jiaxing University",
      "嘉兴市",
      "Jiaxing",
    ]);
    expect(meetMapCityQueries("Jiaxing, China", "嘉兴市")).toEqual([
      "嘉兴市",
      "Jiaxing",
    ]);
  });
});
