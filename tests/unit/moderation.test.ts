import { describe, expect, it } from "vitest";
import {
  canAccessReport,
  ModerationError,
  validateReportTransition,
} from "@/lib/moderation";

const moderator = { id: "moderator-1", role: "MODERATOR" };
const admin = { id: "admin-1", role: "ADMIN" };

describe("moderation report policy", () => {
  it("limits moderators to unassigned or self-assigned cases", () => {
    expect(canAccessReport(moderator, { assigneeId: null })).toBe(true);
    expect(canAccessReport(moderator, { assigneeId: moderator.id })).toBe(true);
    expect(canAccessReport(moderator, { assigneeId: "moderator-2" })).toBe(
      false,
    );
    expect(canAccessReport(admin, { assigneeId: "moderator-2" })).toBe(true);
    expect(
      canAccessReport({ id: "member-1", role: "MEMBER" }, { assigneeId: null }),
    ).toBe(false);
  });

  it("allows OPEN to REVIEWING only for an authorized assignee", () => {
    expect(() =>
      validateReportTransition({
        actor: moderator,
        report: { status: "OPEN", assigneeId: moderator.id },
        targetStatus: "REVIEWING",
      }),
    ).not.toThrow();
    expect(() =>
      validateReportTransition({
        actor: moderator,
        report: { status: "OPEN", assigneeId: null },
        targetStatus: "REVIEWING",
      }),
    ).toThrow(ModerationError);
  });

  it("enforces final decisions that match resolution or dismissal", () => {
    expect(() =>
      validateReportTransition({
        actor: moderator,
        report: { status: "REVIEWING", assigneeId: moderator.id },
        targetStatus: "RESOLVED",
        decision: "VIOLATION_CONFIRMED",
        resolution: "The preserved evidence confirms the reported violation.",
      }),
    ).not.toThrow();
    expect(() =>
      validateReportTransition({
        actor: moderator,
        report: { status: "REVIEWING", assigneeId: moderator.id },
        targetStatus: "DISMISSED",
        decision: "NO_VIOLATION",
        resolution: "The preserved evidence does not show a policy violation.",
      }),
    ).not.toThrow();
    expect(() =>
      validateReportTransition({
        actor: moderator,
        report: { status: "REVIEWING", assigneeId: moderator.id },
        targetStatus: "RESOLVED",
        decision: "NO_VIOLATION",
        resolution: "This decision is inconsistent with the selected status.",
      }),
    ).toThrow(/does not match/);
    expect(() =>
      validateReportTransition({
        actor: moderator,
        report: { status: "REVIEWING", assigneeId: moderator.id },
        targetStatus: "RESOLVED",
      }),
    ).toThrow(/decision and resolution/);
  });

  it("rejects skipped and repeated transitions", () => {
    expect(() =>
      validateReportTransition({
        actor: moderator,
        report: { status: "OPEN", assigneeId: moderator.id },
        targetStatus: "RESOLVED",
        decision: "VIOLATION_CONFIRMED",
        resolution: "A final result cannot skip the review state.",
      }),
    ).toThrow(/Invalid report status transition/);
    expect(() =>
      validateReportTransition({
        actor: moderator,
        report: { status: "RESOLVED", assigneeId: moderator.id },
        targetStatus: "RESOLVED",
        decision: "VIOLATION_CONFIRMED",
        resolution: "A closed report cannot be closed a second time.",
      }),
    ).toThrow(/Invalid report status transition/);
  });

  it("reserves controlled reopening for administrators and requires a reason", () => {
    expect(() =>
      validateReportTransition({
        actor: moderator,
        report: { status: "RESOLVED", assigneeId: moderator.id },
        targetStatus: "REVIEWING",
        resolution: "New material evidence requires a second review.",
      }),
    ).toThrow(/cannot be reopened/);
    expect(() =>
      validateReportTransition({
        actor: admin,
        report: { status: "DISMISSED", assigneeId: moderator.id },
        targetStatus: "REVIEWING",
      }),
    ).toThrow(/reopening reason/);
    expect(() =>
      validateReportTransition({
        actor: admin,
        report: { status: "DISMISSED", assigneeId: moderator.id },
        targetStatus: "REVIEWING",
        resolution: "A new evidence source requires controlled reopening.",
      }),
    ).not.toThrow();
  });
});
