import { describe, expect, it } from "vitest";
import { resolveSpaceExitPath } from "@/lib/space-exit";

describe("leaving a dedicated space", () => {
  it("returns to the page the member came from", () => {
    expect(resolveSpaceExitPath("/marketplace", "/student-hub")).toBe(
      "/marketplace",
    );
    expect(resolveSpaceExitPath("/communities/abc", "/student-hub")).toBe(
      "/communities/abc",
    );
  });

  it("never returns a path inside the space itself", () => {
    // A recorded hub path would make the button a tab switch, not an exit.
    expect(resolveSpaceExitPath("/student-hub", "/student-hub")).toBeNull();
    expect(
      resolveSpaceExitPath("/student-hub/essentials/notes", "/student-hub"),
    ).toBeNull();
  });

  it("does not confuse a sibling route with the space", () => {
    expect(resolveSpaceExitPath("/student-hub-archive", "/student-hub")).toBe(
      "/student-hub-archive",
    );
  });

  it("refuses anything that is not an in-app path", () => {
    expect(resolveSpaceExitPath(null, "/student-hub")).toBeNull();
    expect(resolveSpaceExitPath("", "/student-hub")).toBeNull();
    expect(
      resolveSpaceExitPath("https://evil.example.com", "/student-hub"),
    ).toBeNull();
    expect(
      resolveSpaceExitPath("//evil.example.com", "/student-hub"),
    ).toBeNull();
    expect(
      resolveSpaceExitPath("/\\evil.example.com", "/student-hub"),
    ).toBeNull();
  });
});
