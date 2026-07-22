import { afterEach, describe, expect, it, vi } from "vitest";
import { logServerError, logServerEvent } from "@/lib/logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("structured server logging", () => {
  it("writes searchable lifecycle events without payload contents", () => {
    const output = vi.spyOn(console, "info").mockImplementation(() => {});

    logServerEvent("student-hub.schedule.saved", {
      importId: "import-1",
      courseCount: 4,
    });

    const serialized = String(output.mock.calls[0]?.[0]);
    expect(serialized).toContain('"level":"info"');
    expect(serialized).toContain('"event":"student-hub.schedule.saved"');
    expect(serialized).toContain('"courseCount":4');
  });

  it("never serializes exception messages or stacks", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(
      new Error("database_url=postgresql://admin:private-password@example/db"),
      { code: "P1001" },
    );

    logServerError("database.connect", error, { operation: "readiness" });

    const serialized = String(output.mock.calls[0]?.[0]);
    expect(serialized).toContain('"event":"database.connect"');
    expect(serialized).toContain('"errorCode":"P1001"');
    expect(serialized).toContain('"operation":"readiness"');
    expect(serialized).not.toContain("private-password");
    expect(serialized).not.toContain("database_url");
    expect(serialized).not.toContain("Error:");
  });
});
