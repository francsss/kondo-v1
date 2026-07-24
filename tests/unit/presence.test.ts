import { describe, expect, it } from "vitest";
import {
  describePresencePath,
  normalizePresencePath,
  parseUserAgent,
} from "@/lib/presence";
import { getEstimatedSessionRange } from "@/lib/presence-shared";

describe("presence helpers", () => {
  it("classifies common devices without retaining the raw user agent", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toEqual({
      device: "Mobile",
      browser: "Safari",
      operatingSystem: "iOS",
    });
    expect(
      parseUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 Edg/126.0",
      ),
    ).toEqual({
      device: "Desktop",
      browser: "Edge",
      operatingSystem: "Windows",
    });
  });

  it("removes query strings and private dynamic route identifiers", () => {
    expect(
      normalizePresencePath("/messages/conversation-secret?token=private"),
    ).toBe("/messages/[conversation]");
    expect(normalizePresencePath("/profile/ama-mensah#activity")).toBe(
      "/profile/[member]",
    );
    expect(
      normalizePresencePath("/communities/housing-roommates?post=secret"),
    ).toBe("/communities/[community]");
    expect(describePresencePath("/messages/[conversation]")).toBe(
      "Conversation",
    );
  });

  it("reports five-minute estimated session ranges", () => {
    const connectedAt = new Date("2026-07-24T00:00:00.000Z");
    expect(
      getEstimatedSessionRange(
        connectedAt,
        new Date("2026-07-24T00:04:59.000Z"),
      ).label,
    ).toBe("0–5 min");
    expect(
      getEstimatedSessionRange(
        connectedAt,
        new Date("2026-07-24T00:07:00.000Z"),
      ).label,
    ).toBe("5–10 min");
  });
});
