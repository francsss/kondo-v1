import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MeetDiscoveryMap } from "@/components/features/community/MeetDiscoveryMap";

describe("MeetDiscoveryMap", () => {
  it("renders and starts its base-map state without waiting for nearby members", () => {
    const previousKey = process.env.NEXT_PUBLIC_BAIDU_MAP_AK;
    process.env.NEXT_PUBLIC_BAIDU_MAP_AK = "public-browser-ak";
    try {
      const markup = renderToStaticMarkup(
        createElement(MeetDiscoveryMap, {
          areaLabel: "Around Jiaxing University",
          cityQueries: ["嘉兴市", "Jiaxing"],
          distanceRange: "KM_5",
          mapQueries: ["嘉兴大学", "Jiaxing University"],
          mode: "NEARBY",
          onPremiumRequest: () => {},
          premiumFeatures: [],
          profiles: [],
          showEmptyState: false,
          viewer: {
            avatarMediaId: null,
            firstName: "Test",
            id: "viewer-1",
            lastName: "Student",
          },
        }),
      );

      expect(markup).toContain('data-map-provider="baidu"');
      expect(markup).toContain('data-map-status="loading"');
      expect(markup).toContain("Loading real map");
      expect(markup).not.toContain("No map matches yet");
    } finally {
      if (previousKey === undefined) {
        delete process.env.NEXT_PUBLIC_BAIDU_MAP_AK;
      } else {
        process.env.NEXT_PUBLIC_BAIDU_MAP_AK = previousKey;
      }
    }
  });
});
