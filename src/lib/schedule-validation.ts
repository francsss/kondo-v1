import type { ExtractedSchedule } from "@/features/student-hub/schemas";

export type DocumentQualityDiagnostic = {
  fileName: string;
  mimeType: string;
  method: string;
  pageCount: number;
  characterCount: number;
  confidence: number | null;
  warnings: string[];
  attempts: string[];
};

export type ScheduleValidationDiagnostic = {
  duplicatePairs: number[][];
  conflictPairs: number[][];
  incompleteCourseIndexes: number[];
  warningCount: number;
};

const timetableSignalPatterns = [
  /\b(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i,
  /(?:星期[一二三四五六日天]|周[一二三四五六日天])/,
  /\b(?:[01]?\d|2[0-3])[:.]\d{2}\b/,
  /\b(?:course|class|room|teacher|period|semester|timetable|schedule)\b/i,
  /(?:课程|教室|老师|教师|节|学期|课表|周次)/,
];

export function assessExtractedDocument(input: {
  text: string;
  confidence: number | null;
}) {
  const usefulCharacters = input.text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
  const signalCount = timetableSignalPatterns.filter((pattern) =>
    pattern.test(input.text),
  ).length;

  if (
    usefulCharacters < 8 ||
    (input.confidence !== null &&
      input.confidence < 18 &&
      usefulCharacters < 40)
  ) {
    return {
      ok: false as const,
      code: "DOCUMENT_TOO_BLURRY" as const,
      message:
        "The document is too blurry or low-contrast to read reliably. Try a sharper photo taken straight above the page, or upload the original PDF.",
      usefulCharacters,
      signalCount,
    };
  }

  if (signalCount === 0 && usefulCharacters < 160) {
    return {
      ok: false as const,
      code: "NO_TIMETABLE_DETECTED" as const,
      message:
        "No timetable structure was detected in this document. Upload a page that clearly shows course names together with days, dates, times, or period numbers.",
      usefulCharacters,
      signalCount,
    };
  }

  return { ok: true as const, usefulCharacters, signalCount };
}

function courseWindow(course: ExtractedSchedule["courses"][number]) {
  const start =
    course.startTime ??
    (course.startPeriod ? String(course.startPeriod).padStart(2, "0") : null);
  const end =
    course.endTime ??
    (course.endPeriod ? String(course.endPeriod).padStart(2, "0") : null);
  return start && end ? { start, end } : null;
}

function weekRangesOverlap(
  left: ExtractedSchedule["courses"][number],
  right: ExtractedSchedule["courses"][number],
) {
  if (left.specificDate || right.specificDate) {
    return left.specificDate === right.specificDate;
  }
  const leftStart = left.startWeek ?? 1;
  const leftEnd = left.endWeek ?? 60;
  const rightStart = right.startWeek ?? 1;
  const rightEnd = right.endWeek ?? 60;
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

export function validateExtractedSchedule(
  schedule: ExtractedSchedule,
  options: {
    configuredPeriodNumbers?: number[];
    periodConfigurationAvailable?: boolean;
  } = {},
): {
  schedule: ExtractedSchedule;
  diagnostics: ScheduleValidationDiagnostic;
} {
  const duplicatePairs: number[][] = [];
  const conflictPairs: number[][] = [];
  const incompleteCourseIndexes: number[] = [];
  const warnings = new Set(schedule.warnings);
  const configuredPeriods = new Set(options.configuredPeriodNumbers ?? []);
  const courses = schedule.courses.map((course, index) => {
    const uncertain = new Set(course.uncertainFields);
    uncertain.delete("teacher");
    uncertain.delete("room");
    uncertain.delete("classroom");
    for (const [field, period] of [
      ["startPeriod", course.startPeriod],
      ["endPeriod", course.endPeriod],
    ] as const) {
      if (
        period &&
        configuredPeriods.size > 0 &&
        !configuredPeriods.has(period)
      ) {
        uncertain.add(field);
        warnings.add(
          `Unknown period ${period} in "${course.courseName}". Verify the period or enter the class time manually.`,
        );
      }
    }
    if (
      options.periodConfigurationAvailable === false &&
      (course.startPeriod || course.endPeriod) &&
      (!course.startTime || !course.endTime)
    ) {
      uncertain.add("time");
    }
    if (uncertain.size > 0) incompleteCourseIndexes.push(index);
    return {
      ...course,
      confidence: Math.min(
        course.confidence,
        uncertain.size > 0 ? 0.74 : course.confidence,
      ),
      uncertainFields: [...uncertain],
    };
  });

  for (let leftIndex = 0; leftIndex < courses.length; leftIndex += 1) {
    const left = courses[leftIndex];
    const leftWindow = courseWindow(left);
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < courses.length;
      rightIndex += 1
    ) {
      const right = courses[rightIndex];
      const rightWindow = courseWindow(right);
      if (
        left.dayOfWeek !== right.dayOfWeek ||
        !weekRangesOverlap(left, right) ||
        !leftWindow ||
        !rightWindow
      ) {
        continue;
      }
      const sameWindow =
        leftWindow.start === rightWindow.start &&
        leftWindow.end === rightWindow.end;
      const sameCourse =
        left.courseName.trim().toLocaleLowerCase() ===
        right.courseName.trim().toLocaleLowerCase();
      if (sameCourse && sameWindow) {
        duplicatePairs.push([leftIndex, rightIndex]);
        warnings.add(
          `Possible duplicate: "${left.courseName}" appears more than once in the same time slot.`,
        );
      } else if (
        leftWindow.start < rightWindow.end &&
        rightWindow.start < leftWindow.end
      ) {
        conflictPairs.push([leftIndex, rightIndex]);
        warnings.add(
          `Possible conflict: "${left.courseName}" overlaps "${right.courseName}".`,
        );
      }
    }
  }

  if (incompleteCourseIndexes.length > 0) {
    warnings.add(
      `${incompleteCourseIndexes.length} course${
        incompleteCourseIndexes.length === 1 ? "" : "s"
      } contain uncertain fields. Review the highlighted information before confirming.`,
    );
  }
  if (options.periodConfigurationAvailable === false) {
    warnings.add(
      "Your university timetable periods are not configured yet. Explicit times were preserved; courses containing only period numbers need manual time confirmation.",
    );
  }

  return {
    schedule: { ...schedule, courses, warnings: [...warnings] },
    diagnostics: {
      duplicatePairs,
      conflictPairs,
      incompleteCourseIndexes,
      warningCount: warnings.size,
    },
  };
}
