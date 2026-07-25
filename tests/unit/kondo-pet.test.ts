import { describe, expect, it } from "vitest";
import { isKondoPetPath, kondoPetSessionKey } from "@/lib/kondo-pet";
import {
  petFeedbackNoteSchema,
  petFeedbackStatusSchema,
  petFeedbackSubmissionSchema,
} from "@/lib/pet-feedback-validation";

describe("Kondo Pet route targeting", () => {
  it("appears only in the intended MVP product areas", () => {
    expect(isKondoPetPath("/home")).toBe(true);
    expect(isKondoPetPath("/communities/campus-life")).toBe(true);
    expect(isKondoPetPath("/explore/jiaxing/events")).toBe(true);
    expect(isKondoPetPath("/marketplace/listing")).toBe(true);
    expect(isKondoPetPath("/student-hub/tools")).toBe(true);
    expect(isKondoPetPath("/messages")).toBe(false);
    expect(isKondoPetPath("/stories")).toBe(false);
    expect(isKondoPetPath("/admin/feedback")).toBe(false);
  });

  it("deduplicates appearances by stable product area", () => {
    expect(kondoPetSessionKey("/communities/one")).toBe(
      kondoPetSessionKey("/communities/two"),
    );
    expect(kondoPetSessionKey("/explore/jiaxing")).not.toBe(
      kondoPetSessionKey("/home"),
    );
  });
});

describe("Kondo Pet feedback validation", () => {
  it("accepts a concise structured feedback submission", () => {
    expect(
      petFeedbackSubmissionSchema.safeParse({
        category: "IDEA",
        message: "Add a city arrival checklist.",
        pagePath: "/student-hub",
        submittedAfterMs: 12_500,
      }).success,
    ).toBe(true);
  });

  it("rejects unsafe paths, oversized durations, and empty content", () => {
    expect(
      petFeedbackSubmissionSchema.safeParse({
        category: "BUG",
        message: "Broken",
        pagePath: "//malicious.example",
      }).success,
    ).toBe(false);
    expect(
      petFeedbackSubmissionSchema.safeParse({
        category: "OTHER",
        message: "x",
        pagePath: "/home",
        submittedAfterMs: 4_000_000,
      }).success,
    ).toBe(false);
  });

  it("validates optimistic status changes and bounded internal notes", () => {
    expect(
      petFeedbackStatusSchema.safeParse({
        status: "IN_PROGRESS",
        expectedVersion: 1,
      }).success,
    ).toBe(true);
    expect(
      petFeedbackNoteSchema.safeParse({ body: "Follow up with product." })
        .success,
    ).toBe(true);
    expect(
      petFeedbackStatusSchema.safeParse({
        status: "DISMISSED",
        expectedVersion: 0,
      }).success,
    ).toBe(false);
  });
});
