import { describe, expect, it } from "vitest";
import {
  academicTaskInputSchema,
  academicTaskUpdateSchema,
} from "@/features/student-hub/schemas";

describe("academic task validation", () => {
  it("creates a course-linked task with a valid reminder", () => {
    const result = academicTaskInputSchema.parse({
      title: "Review chapter 4",
      kind: "ASSIGNMENT",
      status: "PENDING",
      priority: "HIGH",
      dueAt: "2026-08-01T12:00:00.000Z",
      reminderAt: "2026-08-01T10:00:00.000Z",
    });
    expect(result.title).toBe("Review chapter 4");
  });

  it("rejects a reminder scheduled after the deadline", () => {
    const result = academicTaskInputSchema.safeParse({
      title: "Physics exam",
      kind: "EXAM",
      dueAt: "2026-08-01T12:00:00.000Z",
      reminderAt: "2026-08-01T13:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a status-only task update", () => {
    expect(
      academicTaskUpdateSchema.safeParse({ status: "COMPLETED" }).success,
    ).toBe(true);
  });
});
