import { describe, expect, it } from "vitest";
import {
  allNotificationPresentations,
  CATEGORY_PREFERENCE_FIELD,
  notificationPresentation,
  type KondoNotificationCategory,
} from "@/features/notifications/presentation";

describe("notification presentation", () => {
  it("gives every Kondo notification kind an icon, a category and an action", () => {
    const presentations = allNotificationPresentations();
    expect(presentations).toHaveLength(20);
    for (const presentation of presentations) {
      expect(presentation.icon).toBeTruthy();
      expect(presentation.categoryLabel).toBeTruthy();
      expect(presentation.actionLabel).toBeTruthy();
      expect(CATEGORY_PREFERENCE_FIELD).toHaveProperty(presentation.category);
    }
  });

  it("prefers an explicit kind over the template and type fallbacks", () => {
    expect(
      notificationPresentation({
        type: "ACCOUNT",
        templateKey: "ACCOUNT_WELCOME",
        kind: "TRANSFER_RECEIVED",
      }).category,
    ).toBe("transfers");
  });

  it("resolves the template key before the coarser notification type", () => {
    // SCHOLARSHIP_MATCH is typed RECOMMENDATION but belongs to University, which
    // is the distinction the category preference gate depends on.
    expect(
      notificationPresentation({
        type: "RECOMMENDATION",
        templateKey: "SCHOLARSHIP_MATCH",
      }),
    ).toMatchObject({
      kind: "UNIVERSITY_ANNOUNCEMENT",
      category: "university",
    });

    expect(
      notificationPresentation({
        type: "MEET_ACTIVITY",
        templateKey: "MEET_MATCHES",
      }),
    ).toMatchObject({ kind: "FRIEND_REQUEST", category: "friends" });
  });

  it("falls back to the notification type, then to a system update", () => {
    expect(
      notificationPresentation({ type: "MESSAGE", templateKey: null }).kind,
    ).toBe("NEW_MESSAGE");
    expect(
      notificationPresentation({ type: "UNKNOWN_TYPE", templateKey: null })
        .kind,
    ).toBe("SYSTEM_UPDATE");
    expect(
      notificationPresentation({
        type: "UNKNOWN_TYPE",
        templateKey: "NOT_A_TEMPLATE",
        kind: "ALSO_NOT_A_KIND",
      }).kind,
    ).toBe("SYSTEM_UPDATE");
  });

  it("keeps safety and account categories immune to the preference gate", () => {
    expect(CATEGORY_PREFERENCE_FIELD.security).toBeNull();
    expect(CATEGORY_PREFERENCE_FIELD.system).toBeNull();
  });

  it("adds a category gate only where NotificationType cannot already express it", () => {
    const silenceable = (
      Object.keys(CATEGORY_PREFERENCE_FIELD) as KondoNotificationCategory[]
    ).filter((category) => CATEGORY_PREFERENCE_FIELD[category] !== null);

    // Messages, communities, marketplace and schedule keep their existing
    // type-level rules, so this gate must not double-gate them.
    expect(silenceable.sort()).toEqual([
      "events",
      "friends",
      "transfers",
      "university",
    ]);
  });
});
