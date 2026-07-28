export type UniversityPeriodDraft = {
  periodNumber: number;
  startTime: string;
  durationMinutes: number;
};

export type UniversityPeriodIssue = {
  code:
    | "DUPLICATE_PERIOD"
    | "INVALID_PERIOD_NUMBER"
    | "INVALID_START_TIME"
    | "INVALID_DURATION"
    | "END_OUTSIDE_DAY"
    | "OVERLAPPING_PERIODS";
  message: string;
  indexes: number[];
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function universityTimeToMinutes(value: string) {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatUniversityMinutes(minutes: number) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 24 * 60) {
    return null;
  }
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;
}

export function calculateUniversityPeriodEnd(
  startTime: string,
  durationMinutes: number,
) {
  const start = universityTimeToMinutes(startTime);
  if (
    start === null ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0
  ) {
    return null;
  }
  return formatUniversityMinutes(start + durationMinutes);
}

export function deriveUniversityPeriodDuration(
  startTime: string,
  endTime: string,
) {
  const start = universityTimeToMinutes(startTime);
  const end = universityTimeToMinutes(endTime);
  if (start === null || end === null || end <= start) return null;
  return end - start;
}

export function validateUniversityPeriodDrafts(
  periods: UniversityPeriodDraft[],
) {
  const issues: UniversityPeriodIssue[] = [];
  const periodIndexes = new Map<number, number>();
  const ranges: Array<{
    index: number;
    periodNumber: number;
    start: number;
    end: number;
  }> = [];

  periods.forEach((period, index) => {
    if (
      !Number.isInteger(period.periodNumber) ||
      period.periodNumber < 1 ||
      period.periodNumber > 40
    ) {
      issues.push({
        code: "INVALID_PERIOD_NUMBER",
        message: "Period numbers must be whole numbers between 1 and 40.",
        indexes: [index],
      });
    } else {
      const previousIndex = periodIndexes.get(period.periodNumber);
      if (previousIndex !== undefined) {
        issues.push({
          code: "DUPLICATE_PERIOD",
          message: `Period ${period.periodNumber} is duplicated.`,
          indexes: [previousIndex, index],
        });
      } else {
        periodIndexes.set(period.periodNumber, index);
      }
    }

    const start = universityTimeToMinutes(period.startTime);
    if (start === null) {
      issues.push({
        code: "INVALID_START_TIME",
        message: `Period ${period.periodNumber || index + 1} needs a valid start time.`,
        indexes: [index],
      });
      return;
    }
    if (
      !Number.isInteger(period.durationMinutes) ||
      period.durationMinutes < 1 ||
      period.durationMinutes > 240
    ) {
      issues.push({
        code: "INVALID_DURATION",
        message: `Period ${period.periodNumber || index + 1} needs a duration between 1 and 240 minutes.`,
        indexes: [index],
      });
      return;
    }
    const end = start + period.durationMinutes;
    if (end >= 24 * 60) {
      issues.push({
        code: "END_OUTSIDE_DAY",
        message: `Period ${period.periodNumber || index + 1} ends outside the same day.`,
        indexes: [index],
      });
      return;
    }
    ranges.push({ index, periodNumber: period.periodNumber, start, end });
  });

  for (let left = 0; left < ranges.length; left += 1) {
    for (let right = left + 1; right < ranges.length; right += 1) {
      const first = ranges[left]!;
      const second = ranges[right]!;
      if (first.start < second.end && second.start < first.end) {
        issues.push({
          code: "OVERLAPPING_PERIODS",
          message: `Period ${first.periodNumber} overlaps period ${second.periodNumber}.`,
          indexes: [first.index, second.index],
        });
      }
    }
  }

  return issues;
}
