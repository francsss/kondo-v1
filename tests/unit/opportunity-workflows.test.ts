import { describe, expect, it } from "vitest";
import {
  opportunityInterviewSchema,
  opportunityProfileSchema,
} from "@/features/opportunities/schemas";
import { reminderIsDue } from "@/lib/opportunity-reminders";

describe("opportunity workflow validation", () => {
  it("requires a secure destination for video and in-person interviews", () => {
    const scheduledAt = new Date(Date.now() + 86_400_000).toISOString();
    expect(
      opportunityInterviewSchema.safeParse({
        format: "VIDEO",
        scheduledAt,
        timezone: "Asia/Shanghai",
      }).success,
    ).toBe(false);
    expect(
      opportunityInterviewSchema.safeParse({
        format: "IN_PERSON",
        scheduledAt,
        timezone: "Asia/Shanghai",
      }).success,
    ).toBe(false);
    expect(
      opportunityInterviewSchema.safeParse({
        format: "VIDEO",
        scheduledAt,
        timezone: "Asia/Shanghai",
        meetingUrl: "https://meet.example.org/interview",
      }).success,
    ).toBe(true);
  });

  it("keeps recommendation and reminder choices explicit", () => {
    const profile = opportunityProfileSchema.parse({
      recommendationsEnabled: false,
      deadlineReminderDays: [7, 1],
    });
    expect(profile.recommendationsEnabled).toBe(false);
    expect(profile.deadlineReminderDays).toEqual([7, 1]);
    expect(
      opportunityProfileSchema.safeParse({ deadlineReminderDays: [5] }).success,
    ).toBe(false);
  });

  it("queues a deadline reminder once its chosen window starts", () => {
    const deadline = new Date("2026-09-20T00:00:00.000Z");
    const now = new Date("2026-09-13T00:00:01.000Z");
    expect(reminderIsDue({ deadline, days: 7, now })).toBe(true);
    expect(reminderIsDue({ deadline, days: 7, now, lastRemindedAt: now })).toBe(
      false,
    );
    expect(
      reminderIsDue({
        deadline,
        days: 7,
        now: new Date("2026-09-12T23:59:59.000Z"),
      }),
    ).toBe(false);
  });
});
