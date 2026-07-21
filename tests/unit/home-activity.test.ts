import { describe, expect, it } from "vitest";
import type { HomeActivityItem } from "@/features/activity/types";
import { mergeHomeActivities } from "@/lib/home-activity";

function activity(
  id: string,
  occurredAt: string,
  type: HomeActivityItem["type"] = "MEMBER_JOINED",
): HomeActivityItem {
  return {
    id,
    type,
    occurredAt,
    actor: null,
    action: "happened",
    subject: null,
    detail: null,
    href: "/home",
  };
}

describe("home activity stream", () => {
  it("merges heterogeneous events into one newest-first timeline", () => {
    const result = mergeHomeActivities([
      [activity("member", "2026-07-21T09:00:00.000Z")],
      [activity("post", "2026-07-21T09:03:00.000Z", "POST_CREATED")],
      [activity("community", "2026-07-21T09:01:00.000Z", "COMMUNITY_CREATED")],
    ]);

    expect(result.map(({ id }) => id)).toEqual(["post", "community", "member"]);
  });

  it("enforces the requested display limit after merging", () => {
    const events = Array.from({ length: 12 }, (_, index) =>
      activity(`event-${index}`, new Date(1_000 + index).toISOString()),
    );

    expect(mergeHomeActivities([events], 5)).toHaveLength(5);
    expect(mergeHomeActivities([events], 5)[0]?.id).toBe("event-11");
  });
});
