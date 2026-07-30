import { describe, expect, it } from "vitest";
import {
  normalizeAnalyticsRoute,
  productAreaForPath,
  sanitizeProductProperties,
} from "@/lib/product-analytics-events";

describe("product analytics privacy", () => {
  it("drops sensitive property names and bounds string values", () => {
    const result = sanitizeProductProperties({
      email: "member@example.com",
      message_content: "private",
      file_name: "schedule.pdf",
      city: "Jiaxing",
      duration_ms: 250,
      description: "x".repeat(300),
    });
    expect(result).toEqual({
      city: "Jiaxing",
      duration_ms: 250,
      description: "x".repeat(160),
    });
  });

  it("normalizes user and API identifiers before capture", () => {
    expect(
      normalizeAnalyticsRoute(
        "/api/student-hub/imports/private-id/analyze?token=secret",
      ),
    ).toBe("/api/student-hub/imports/[import]");
    expect(normalizeAnalyticsRoute("/communities/private-slug?post=id")).toBe(
      "/communities/[community]",
    );
    expect(
      normalizeAnalyticsRoute(
        "/organizations/private-slug/verification?request=private-id",
      ),
    ).toBe("/organizations/[organization]/[workspace-section]");
    expect(
      normalizeAnalyticsRoute(
        "/organization-invitations/private-token?source=email",
      ),
    ).toBe("/organization-invitations/[invitation]");
  });

  it("maps routes to stable product areas", () => {
    expect(productAreaForPath("/student-hub/tools")).toBe("student_hub");
    expect(productAreaForPath("/explore/jiaxing/jobs")).toBe("explore");
    expect(productAreaForPath("/messages/conversation-id")).toBe("messages");
    expect(productAreaForPath("/stories")).toBe("student_stories");
    expect(productAreaForPath("/stories/submit")).toBe("student_stories");
    expect(productAreaForPath("/organizations/acme/dashboard")).toBe(
      "organizations",
    );
  });
});
