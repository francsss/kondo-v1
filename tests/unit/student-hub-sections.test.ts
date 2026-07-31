import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPPORTUNITY_TYPES } from "@/lib/opportunity-types";
import {
  STUDENT_HUB_SECTIONS,
  studentHubSection,
  studentHubSectionForType,
  studentHubSectionTypes,
  unmappedOpportunityTypes,
} from "@/lib/student-hub-sections";

describe("Student Hub section registry", () => {
  it("exposes exactly the intended information architecture, in order", () => {
    expect(STUDENT_HUB_SECTIONS.map((section) => section.key)).toEqual([
      "overview",
      "scholarships",
      "internships",
      "jobs",
      "programs",
      "applications",
    ]);
  });

  it("no longer contains a generic Opportunities entry", () => {
    const labels = STUDENT_HUB_SECTIONS.map((section) =>
      section.label.toLowerCase(),
    );
    expect(labels).not.toContain("opportunities");
    for (const section of STUDENT_HUB_SECTIONS) {
      expect(section.href.startsWith("/student-hub")).toBe(true);
    }
  });

  it("gives every section its own title rather than a shared one", () => {
    const titles = STUDENT_HUB_SECTIONS.map((section) => section.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe("Student Hub filter mapping", () => {
  it("maps Scholarships to the scholarship type only", () => {
    expect(studentHubSectionTypes("scholarships")).toEqual(["SCHOLARSHIP"]);
  });

  it("maps Internships to student and graduate internships", () => {
    expect(studentHubSectionTypes("internships")).toEqual([
      "INTERNSHIP",
      "GRADUATE_INTERNSHIP",
    ]);
  });

  it("maps Jobs to part-time, full-time and campus work", () => {
    expect(studentHubSectionTypes("jobs")).toEqual([
      "PART_TIME_JOB",
      "FULL_TIME_JOB",
      "CAMPUS_JOB",
    ]);
  });

  it("maps Programs & Research across research, programmes and volunteering", () => {
    expect(studentHubSectionTypes("programs")).toEqual([
      "RESEARCH_OPPORTUNITY",
      "VOLUNTEERING",
      "COMPETITION",
      "EXCHANGE_PROGRAM",
      "SUMMER_PROGRAM",
      "OTHER_PROGRAM",
    ]);
  });

  it("keeps the listing sections mutually exclusive", () => {
    const seen = new Set<string>();
    for (const section of STUDENT_HUB_SECTIONS) {
      for (const type of section.types) {
        expect(seen.has(type)).toBe(false);
        seen.add(type);
      }
    }
  });

  it("surfaces every opportunity type in exactly one section", () => {
    expect(unmappedOpportunityTypes()).toEqual([]);
    for (const type of OPPORTUNITY_TYPES) {
      expect(studentHubSectionForType(type.key)?.key).toBeDefined();
    }
  });

  it("leaves Overview and Applications without a type projection", () => {
    expect(studentHubSectionTypes("overview")).toEqual([]);
    expect(studentHubSectionTypes("applications")).toEqual([]);
  });

  it("rejects an unknown section rather than silently returning nothing", () => {
    expect(() => studentHubSection("housing" as never)).toThrow(
      /Unknown Student Hub section/,
    );
  });
});

describe("Student Hub shell", () => {
  const source = readFileSync(
    new URL(
      "../../src/components/features/student-hub/StudentHubShell.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  it("builds its tabs from the registry instead of a second hard-coded list", () => {
    expect(source).toContain("STUDENT_HUB_SECTIONS");
    expect(source).not.toContain('"/student-hub/opportunities"');
  });
});
