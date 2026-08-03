import { describe, expect, it } from "vitest";
import {
  activeStudentHubTab,
  studentHubModuleForPath,
  studentHubTabsForModule,
} from "@/components/features/student-hub/StudentHubShell";
import { studentHubAccessForJourney } from "@/lib/personal-journeys";
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

describe("Student Hub module navigation", () => {
  it("groups study work separately from opportunity discovery", () => {
    expect(studentHubModuleForPath("/student-hub")).toBe("studies");
    expect(studentHubModuleForPath("/student-hub/tools")).toBe("studies");
    expect(studentHubModuleForPath("/student-hub/help/visa-renewal")).toBe(
      "studies",
    );
    expect(studentHubModuleForPath("/student-hub/scholarships")).toBe(
      "opportunities",
    );
    expect(studentHubModuleForPath("/student-hub/applications")).toBe(
      "opportunities",
    );
  });

  it("shows Academic tools only for journeys with academic-tool access", () => {
    expect(
      studentHubTabsForModule("studies", true).map((tab) => tab.key),
    ).toEqual(["overview", "tools", "help"]);
    expect(
      studentHubTabsForModule("studies", false).map((tab) => tab.key),
    ).toEqual(["overview", "help"]);
  });

  it("keeps the planner for legacy students with a university affiliation", () => {
    expect(studentHubAccessForJourney(null, true).academicTools).toBe(true);
    expect(studentHubAccessForJourney(null, false).academicTools).toBe(false);
    expect(studentHubAccessForJourney("ALUMNI", true).academicTools).toBe(
      false,
    );
  });

  it("keeps all opportunity destinations in one contextual row", () => {
    expect(
      studentHubTabsForModule("opportunities", true).map((tab) => tab.key),
    ).toEqual([
      "scholarships",
      "internships",
      "jobs",
      "programs",
      "competitions",
      "applications",
    ]);
  });

  it("gives Resources a contextual row of existing Kondo destinations", () => {
    expect(studentHubModuleForPath("/student-hub/resources")).toBe("resources");
    expect(
      studentHubTabsForModule("resources", true).map((tab) => tab.key),
    ).toEqual([
      "resource-home",
      "guides",
      "stories",
      "communities",
      "housing",
      "city-resources",
    ]);
    expect(
      activeStudentHubTab(
        "/student-hub/resources",
        studentHubTabsForModule("resources", true),
      ),
    ).toBe("resource-home");
  });

  it("keeps Studies as the default module", () => {
    expect(studentHubModuleForPath("/student-hub")).toBe("studies");
    expect(studentHubModuleForPath("/student-hub/tools")).toBe("studies");
    expect(studentHubModuleForPath("/student-hub/competitions")).toBe(
      "opportunities",
    );
  });
});
