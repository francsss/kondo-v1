import { describe, expect, it } from "vitest";
import {
  chinaCityNativeName,
  chinaUniversityNativeName,
} from "@/lib/china-map-aliases";
import {
  approximateDistanceMeters,
  deduplicateMeetMapItems,
  friendlyApproximateDistance,
  isLikelyReversedMeetMapCoordinate,
  isValidMeetMapCoordinate,
  JIAXING_UNIVERSITY_WGS84,
  meetMapCityQueries,
  MEET_MAP_COORDINATE_SYSTEM,
  meetMapKnownAnchor,
  meetMapSearchQueries,
  meetMapSearchQuery,
  meetMapZoom,
  privacySafeMapCoordinate,
  privacySafeViewerCoordinate,
} from "@/lib/meet-map";

function approximateDistanceKm(
  first: { lng: number; lat: number },
  second: { lng: number; lat: number },
) {
  return approximateDistanceMeters(first, second) / 1_000;
}

describe("Meet privacy-safe real-map coordinates", () => {
  const jiaxingUniversity = JIAXING_UNIVERSITY_WGS84;

  it("creates stable approximate WGS-84 points inside the maximum radius", () => {
    const first = privacySafeMapCoordinate(jiaxingUniversity, "profile-123");
    const repeated = privacySafeMapCoordinate(jiaxingUniversity, "profile-123");
    const other = privacySafeMapCoordinate(jiaxingUniversity, "profile-456");

    expect(first).toEqual(repeated);
    expect(other).not.toEqual(first);
    expect(approximateDistanceKm(jiaxingUniversity, first)).toBeLessThan(5);
    expect(approximateDistanceKm(jiaxingUniversity, first)).toBeGreaterThan(0);
  });

  it("places two nearby students at distinct privacy-safe points within 5 km", () => {
    const students = ["jiaxing-student-one", "jiaxing-student-two"].map(
      (profileId) => privacySafeMapCoordinate(jiaxingUniversity, profileId),
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
        "嘉兴学院",
        "Jiaxing University, Jiaxing, China",
      ]),
    ).toEqual(jiaxingUniversity);
  });

  it("uses public study-area labels rather than exact user coordinates", () => {
    expect(MEET_MAP_COORDINATE_SYSTEM).toBe("WGS84");
    expect(meetMapSearchQuery("Jiaxing University", "Jiaxing")).toBe(
      "Jiaxing University, Jiaxing, China",
    );
    expect(meetMapZoom(100)).toBeGreaterThan(meetMapZoom(5000));
  });

  it("rejects missing, non-finite, zero, reversed, and out-of-China points", () => {
    expect(isValidMeetMapCoordinate(JIAXING_UNIVERSITY_WGS84)).toBe(true);
    expect(isValidMeetMapCoordinate(null)).toBe(false);
    expect(isValidMeetMapCoordinate({ lng: Number.NaN, lat: 30.7 })).toBe(
      false,
    );
    expect(isValidMeetMapCoordinate({ lng: 0, lat: 0 })).toBe(false);
    expect(isValidMeetMapCoordinate({ lng: 30.746, lat: 120.73 })).toBe(false);
    expect(
      isLikelyReversedMeetMapCoordinate({ lng: 30.746, lat: 120.73 }),
    ).toBe(true);
    expect(isValidMeetMapCoordinate({ lng: -73.98, lat: 40.76 })).toBe(false);
  });

  it("rejects invalid anchors before generating approximate member points", () => {
    expect(() =>
      privacySafeMapCoordinate({ lng: 0, lat: 0 }, "member"),
    ).toThrow("valid China WGS-84");
    expect(() =>
      privacySafeMapCoordinate(JIAXING_UNIVERSITY_WGS84, ""),
    ).toThrow("profile ID");
  });

  it("keeps the viewer near campus and rounds distance into privacy bands", () => {
    const viewer = privacySafeViewerCoordinate(
      jiaxingUniversity,
      "viewer-profile",
    );
    const member = privacySafeMapCoordinate(
      jiaxingUniversity,
      "nearby-profile",
    );
    expect(approximateDistanceMeters(jiaxingUniversity, viewer)).toBeLessThan(
      100,
    );
    expect(approximateDistanceMeters(viewer, member)).toBeGreaterThan(0);
    expect(friendlyApproximateDistance(62)).toBe("Less than 100 m");
    expect(friendlyApproximateDistance(287)).toBe("Around 300 m");
    expect(friendlyApproximateDistance(1_180)).toBe("Around 1 km");
    expect(friendlyApproximateDistance(5_900)).toBe("More than 5 km");
  });

  it("deduplicates nearby members by stable profile ID", () => {
    expect(
      deduplicateMeetMapItems([
        { id: "member-1", name: "First" },
        { id: "member-1", name: "Duplicate" },
        { id: "member-2", name: "Second" },
      ]),
    ).toEqual([
      { id: "member-1", name: "First" },
      { id: "member-2", name: "Second" },
    ]);
  });

  it("prioritizes globally searchable labels and keeps native fallbacks", () => {
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
      "Jiaxing University, Jiaxing, China",
      "Jiaxing University",
      "嘉兴市嘉兴大学",
      "嘉兴大学",
      "Jiaxing",
      "嘉兴市",
    ]);
    expect(meetMapCityQueries("Jiaxing, China", "嘉兴市")).toEqual([
      "Jiaxing",
      "嘉兴市",
    ]);
  });
});
