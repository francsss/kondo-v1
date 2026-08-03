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
  it("splits the hub into study, guide and opportunity pillars", () => {
    expect(studentHubModuleForPath("/student-hub")).toBe("study");
    expect(studentHubModuleForPath("/student-hub/tools")).toBe("study");
    expect(studentHubModuleForPath("/student-hub/essentials")).toBe("study");
    expect(studentHubModuleForPath("/student-hub/resources")).toBe("guide");
    // Student Q&A answers journey questions, not coursework ones.
    expect(studentHubModuleForPath("/student-hub/help/visa-renewal")).toBe(
      "guide",
    );
    expect(studentHubModuleForPath("/student-hub/scholarships")).toBe(
      "opportunities",
    );
    expect(studentHubModuleForPath("/student-hub/applications")).toBe(
      "opportunities",
    );
    expect(studentHubModuleForPath("/student-hub/competitions")).toBe(
      "opportunities",
    );
  });

  it("gates only the planner on academic-tool access", () => {
    expect(
      studentHubTabsForModule("study", true).map((tab) => tab.key),
    ).toEqual(["overview", "tools", "essentials"]);
    // Study Essentials stays reachable for students still preparing to arrive.
    expect(
      studentHubTabsForModule("study", false).map((tab) => tab.key),
    ).toEqual(["overview", "essentials"]);
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

  it("gathers journey support under Guide, with Student Q&A first", () => {
    expect(
      studentHubTabsForModule("guide", true).map((tab) => tab.key),
    ).toEqual([
      "resource-home",
      "help",
      "guides",
      "stories",
      "communities",
      "housing",
      "city-resources",
    ]);
    expect(
      activeStudentHubTab(
        "/student-hub/resources",
        studentHubTabsForModule("guide", true),
      ),
    ).toBe("resource-home");
    expect(
      activeStudentHubTab(
        "/student-hub/help",
        studentHubTabsForModule("guide", true),
      ),
    ).toBe("help");
  });

  it("keeps Study Essentials highlighted on a product and its checkout", () => {
    const tabs = studentHubTabsForModule("study", true);
    for (const path of [
      "/student-hub/essentials",
      "/student-hub/essentials/kondo-student-planner",
      "/student-hub/essentials/kondo-student-planner/checkout",
    ]) {
      expect(activeStudentHubTab(path, tabs)).toBe("essentials");
    }
  });

  it("keeps Study as the default module", () => {
    expect(studentHubModuleForPath("/student-hub")).toBe("study");
    expect(studentHubModuleForPath("/student-hub/tools")).toBe("study");
  });
});
