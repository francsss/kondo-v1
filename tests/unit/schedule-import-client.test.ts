import { describe, expect, it } from "vitest";
import {
  formatImportFileSize,
  validateScheduleImportFiles,
} from "@/lib/schedule-import-client";

function file(name: string, type: string, size = 1024) {
  return { name, type, size } as File;
}

describe("schedule import file selection", () => {
  it.each([
    ["schedule.pdf", "application/pdf"],
    ["schedule.png", "image/png"],
    ["schedule.jpg", "image/jpeg"],
    ["schedule.jpeg", "image/jpeg"],
    ["schedule.webp", "image/webp"],
  ])("accepts %s", (name, type) => {
    expect(validateScheduleImportFiles([file(name, type)])).toBeNull();
  });

  it("rejects mismatched extensions and unsupported files", () => {
    expect(
      validateScheduleImportFiles([file("schedule.png", "image/jpeg")]),
    ).toContain("not a supported");
    expect(
      validateScheduleImportFiles([file("schedule.docx", "application/pdf")]),
    ).toContain("not a supported");
  });

  it("enforces count, individual, and total size limits", () => {
    expect(
      validateScheduleImportFiles(
        Array.from({ length: 6 }, (_, index) =>
          file(`${index}.png`, "image/png"),
        ),
      ),
    ).toContain("no more than 5");
    expect(
      validateScheduleImportFiles([
        file("large.pdf", "application/pdf", 16 * 1024 * 1024),
      ]),
    ).toContain("15 MB");
    expect(
      validateScheduleImportFiles([
        file("one.pdf", "application/pdf", 15 * 1024 * 1024),
        file("two.pdf", "application/pdf", 15 * 1024 * 1024),
        file("three.png", "image/png", 1),
      ]),
    ).toContain("30 MB");
  });

  it("formats readable file sizes", () => {
    expect(formatImportFileSize(512)).toBe("512 B");
    expect(formatImportFileSize(2048)).toBe("2 KB");
    expect(formatImportFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });
});
