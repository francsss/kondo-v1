import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MeetDiscoveryMap } from "@/components/features/community/MeetDiscoveryMap";

describe("MeetDiscoveryMap", () => {
  it("depends on the generic map factory rather than a Google SDK surface", () => {
    const source = readFileSync(
      new URL(
        "../../src/components/features/community/MeetDiscoveryMap.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(source).toContain("createConfiguredMeetMapProvider");
    expect(source).not.toContain("google.maps");
    expect(source).not.toContain("GoogleMapProvider");
    expect(source).not.toContain("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
  });

  it("renders and starts its base-map state without waiting for nearby members", () => {
    const previousKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY =
      "AIza-public-browser-key-for-tests";
    try {
      const markup = renderToStaticMarkup(
        createElement(MeetDiscoveryMap, {
          areaLabel: "Around Jiaxing University",
          mapQueries: ["嘉兴大学", "Jiaxing University"],
          mode: "NEARBY",
          onPremiumRequest: () => {},
          premiumFeatures: [],
          profiles: [],
          radiusMeters: 500,
          showEmptyState: false,
          viewer: {
            avatarMediaId: null,
            firstName: "Test",
            id: "viewer-1",
            lastName: "Student",
          },
        }),
      );

      expect(markup).toContain('data-map-provider="google"');
      expect(markup).toContain('data-map-status="loading"');
      expect(markup).toContain("Loading real map");
      expect(markup).not.toContain("No map matches yet");
    } finally {
      if (previousKey === undefined) {
        delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      } else {
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = previousKey;
      }
    }
  });
});
