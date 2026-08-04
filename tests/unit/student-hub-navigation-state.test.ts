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
  it("splits the hub into four independent pillars", () => {
    expect(studentHubModuleForPath("/student-hub")).toBe("study");
    expect(studentHubModuleForPath("/student-hub/tools")).toBe("study");
    expect(studentHubModuleForPath("/student-hub/tools/academic")).toBe("study");
    // Student Q&A is coursework support, so it sits with Study.
    expect(studentHubModuleForPath("/student-hub/help/visa-renewal")).toBe(
      "study",
    );
    // Study Essentials is a pillar of its own, not a Study tab.
    expect(studentHubModuleForPath("/student-hub/essentials")).toBe(
      "essentials",
    );
    expect(studentHubModuleForPath("/student-hub/essentials/library")).toBe(
      "essentials",
    );
    expect(studentHubModuleForPath("/student-hub/orders/KS-1234")).toBe(
      "essentials",
    );
    expect(studentHubModuleForPath("/student-hub/resources")).toBe("guide");
    expect(studentHubModuleForPath("/student-hub/scholarships")).toBe(
      "opportunities",
    );
    expect(studentHubModuleForPath("/student-hub/applications")).toBe(
      "opportunities",
    );
  });

  it("gates the planner and the tools on academic access, never Q&A", () => {
    expect(
      studentHubTabsForModule("study", true).map((tab) => tab.key),
    ).toEqual(["overview", "tools", "academic-tools", "help"]);
    expect(
      studentHubTabsForModule("study", false).map((tab) => tab.key),
    ).toEqual(["overview", "help"]);
  });

  it("keeps the planner for legacy students with a university affiliation", () => {
    expect(studentHubAccessForJourney(null, true).academicTools).toBe(true);
    expect(studentHubAccessForJourney(null, false).academicTools).toBe(false);
    expect(studentHubAccessForJourney("ALUMNI", true).academicTools).toBe(
      false,
    );
  });

  it("gives Study Essentials the shelves of a workspace", () => {
    expect(
      studentHubTabsForModule("essentials", true).map((tab) => tab.key),
    ).toEqual(["library", "books", "materials", "notes", "resources"]);
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

  it("gathers journey support under Guide", () => {
    expect(
      studentHubTabsForModule("guide", true).map((tab) => tab.key),
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
        studentHubTabsForModule("guide", true),
      ),
    ).toBe("resource-home");
  });

  it("lights the shelf a reader or a receipt belongs to", () => {
    const tabs = studentHubTabsForModule("essentials", true);
    expect(activeStudentHubTab("/student-hub/essentials/library", tabs)).toBe(
      "library",
    );
    expect(activeStudentHubTab("/student-hub/essentials/books", tabs)).toBe(
      "books",
    );
    expect(activeStudentHubTab("/student-hub/essentials/materials", tabs)).toBe(
      "materials",
    );
    // Reading and receipts stay under My Library.
    expect(
      activeStudentHubTab("/student-hub/essentials/read/a-book", tabs),
    ).toBe("library");
    expect(activeStudentHubTab("/student-hub/orders/KS-1234", tabs)).toBe(
      "library",
    );
    // A product page and its checkout belong to the catalogue.
    expect(activeStudentHubTab("/student-hub/essentials", tabs)).toBe(
      "resources",
    );
    expect(
      activeStudentHubTab("/student-hub/essentials/kondo-planner", tabs),
    ).toBe("resources");
    expect(
      activeStudentHubTab(
        "/student-hub/essentials/kondo-planner/checkout",
        tabs,
      ),
    ).toBe("resources");
  });

  it("keeps Study as the default module", () => {
    expect(studentHubModuleForPath("/student-hub")).toBe("study");
    expect(activeStudentHubTab("/student-hub", studentHubTabsForModule("study", true))).toBe(
      "overview",
    );
  });
});
