import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scheduleImport: {
      findFirst: mocks.findFirst,
    },
  },
}));

vi.mock("@/lib/media", () => ({
  removeOwnedMedia: vi.fn(),
}));

import { GET } from "../../app/api/student-hub/imports/[id]/route";

function request() {
  return new NextRequest(
    "http://localhost:3000/api/student-hub/imports/import-1",
  );
}

describe("schedule import recovery status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
  });

  it("returns persisted review data only to the import owner", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "import-1",
      status: "REVIEW_REQUIRED",
      processingStage: "REVIEW",
      errorCode: null,
      errorMessage: null,
      attemptCount: 1,
      scheduleId: null,
      updatedAt: new Date("2026-07-27T10:00:00.000Z"),
      result: {
        extractedJson: {
          title: "Recovered timetable",
          warnings: [],
          courses: [],
        },
        courseCount: 0,
        reviewCount: 0,
        diagnostics: {},
      },
    });

    const response = await GET(request(), {
      params: Promise.resolve({ id: "import-1" }),
    });
    expect(response.status).toBe(200);
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "import-1", ownerId: "user-1" },
      }),
    );
    expect(await response.json()).toEqual(
      expect.objectContaining({
        import: expect.objectContaining({
          status: "REVIEW_REQUIRED",
          result: expect.objectContaining({
            extractedJson: expect.objectContaining({
              title: "Recovered timetable",
            }),
          }),
        }),
      }),
    );
  });

  it("does not expose extraction data after confirmation", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "import-1",
      status: "CONFIRMED",
      processingStage: "COMPLETE",
      errorCode: null,
      errorMessage: null,
      attemptCount: 1,
      scheduleId: "schedule-1",
      updatedAt: new Date("2026-07-27T10:00:00.000Z"),
      result: { extractedJson: { private: "data" } },
    });

    const response = await GET(request(), {
      params: Promise.resolve({ id: "import-1" }),
    });
    expect(await response.json()).toEqual(
      expect.objectContaining({
        import: expect.objectContaining({
          status: "CONFIRMED",
          result: null,
        }),
      }),
    );
  });

  it("requires authentication", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await GET(request(), {
      params: Promise.resolve({ id: "import-1" }),
    });
    expect(response.status).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});
