import { describe, expect, it } from "vitest";
import { NotificationError, safeNotificationHref } from "@/lib/notifications";

describe("notification link safety", () => {
  it("keeps normalized internal product links", () => {
    expect(safeNotificationHref("/messages/thread-1?from=notification")).toBe(
      "/messages/thread-1?from=notification",
    );
    expect(safeNotificationHref("/student-hub#arrival")).toBe(
      "/student-hub#arrival",
    );
    expect(safeNotificationHref(null)).toBeNull();
  });

  it.each([
    "https://evil.example/phish",
    "//evil.example/phish",
    "/admin/users",
    "/messages/../../admin",
    "/messages\\evil",
    "javascript:alert(1)",
  ])("rejects unsafe notification href %s", (href) => {
    expect(() => safeNotificationHref(href)).toThrow(NotificationError);
  });
});
