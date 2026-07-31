import { describe, expect, it } from "vitest";
import { activeStudentHubTab } from "@/components/features/student-hub/StudentHubShell";
import { STUDENT_HUB_SECTIONS } from "@/lib/student-hub-sections";

const tabs = STUDENT_HUB_SECTIONS.map((section) => ({
  key: section.key,
  href: section.href,
  label: section.label,
}));

describe("Student Hub active tab", () => {
  it("keeps each section active on its own route", () => {
    expect(activeStudentHubTab("/student-hub/scholarships", tabs)).toBe(
      "scholarships",
    );
    expect(activeStudentHubTab("/student-hub/internships", tabs)).toBe(
      "internships",
    );
    expect(activeStudentHubTab("/student-hub/jobs", tabs)).toBe("jobs");
    expect(activeStudentHubTab("/student-hub/programs", tabs)).toBe("programs");
    expect(activeStudentHubTab("/student-hub/applications", tabs)).toBe(
      "applications",
    );
  });

  it("keeps Internships active after opening one internship and returning", () => {
    // The section must not hand its highlight back to a generic listing.
    expect(
      activeStudentHubTab("/student-hub/internships?workMode=REMOTE", tabs),
    ).not.toBe("overview");
    expect(activeStudentHubTab("/student-hub/internships", tabs)).toBe(
      "internships",
    );
  });

  it("keeps Scholarships active on a scholarship detail and on advisers", () => {
    expect(
      activeStudentHubTab("/student-hub/scholarships/csc-2026", tabs),
    ).toBe("scholarships");
    expect(activeStudentHubTab("/student-hub/scholarships/agents", tabs)).toBe(
      "scholarships",
    );
  });

  it("gives Overview the hub root and the guide reader", () => {
    expect(activeStudentHubTab("/student-hub", tabs)).toBe("overview");
    expect(activeStudentHubTab("/student-hub/guide/visa-basics", tabs)).toBe(
      "overview",
    );
  });

  it("marks no tab active on an unrelated route", () => {
    expect(activeStudentHubTab("/home", tabs)).toBeNull();
  });
});
