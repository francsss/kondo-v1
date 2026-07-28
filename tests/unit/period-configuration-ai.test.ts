import { describe, expect, it } from "vitest";
import { normalizePeriodStructureCandidate } from "@/lib/period-configuration-ai";

describe("period structure AI normalization", () => {
  it("normalizes common OCR time and period formats", () => {
    expect(
      normalizePeriodStructureCandidate({
        periods: [
          {
            periodNumber: "Period 1",
            startTime: "8：00",
            endTime: "8.40",
            confidence: 0.96,
            uncertainFields: [],
          },
        ],
        warnings: [],
      }),
    ).toEqual({
      periods: [
        {
          periodNumber: 1,
          startTime: "08:00",
          endTime: "08:40",
          confidence: 0.96,
          uncertainFields: [],
        },
      ],
      warnings: [],
    });
  });

  it("marks missing or low-confidence values for explicit review", () => {
    const result = normalizePeriodStructureCandidate({
      periods: [
        {
          periodNumber: null,
          startTime: "10:00",
          endTime: null,
          confidence: 0.6,
        },
      ],
    });
    expect(result.periods[0]?.uncertainFields).toEqual(
      expect.arrayContaining(["periodNumber", "endTime"]),
    );
  });
});
