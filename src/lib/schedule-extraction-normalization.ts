type JsonRecord = Record<string, unknown>;

const COURSE_KEYS = [
  "courses",
  "classes",
  "subjects",
  "courseList",
  "course_list",
] as const;

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function first(source: JsonRecord, keys: readonly string[]) {
  for (const key of keys) {
    if (source[key] !== undefined) return source[key];
  }
  return undefined;
}

function nullableText(value: unknown) {
  if (typeof value !== "string") return value === null ? null : null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizedTime(value: unknown) {
  const text = nullableText(value);
  if (typeof text !== "string") return null;
  const match = text
    .replace(/[：.]/g, ":")
    .match(/(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)(?:\s|$)/);
  if (!match) return text;
  return `${match[1]!.padStart(2, "0")}:${match[2]}`;
}

function pair(value: unknown, pattern: RegExp) {
  if (typeof value !== "string") return [null, null] as const;
  const match = value.match(pattern);
  return match
    ? ([Number(match[1]), Number(match[2] ?? match[1])] as const)
    : ([null, null] as const);
}

function timePair(value: unknown) {
  if (typeof value !== "string") return [null, null] as const;
  const matches = [
    ...value.replace(/[：.]/g, ":").matchAll(/([01]?\d|2[0-3]):([0-5]\d)/g),
  ];
  if (matches.length < 2) return [null, null] as const;
  return [
    `${matches[0]![1]!.padStart(2, "0")}:${matches[0]![2]}`,
    `${matches[1]![1]!.padStart(2, "0")}:${matches[1]![2]}`,
  ] as const;
}

function positiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string") return null;
  const match = value.match(/\d+/);
  const parsed = match ? Number(match[0]) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeDay(value: unknown) {
  if (typeof value === "number" && value >= 1 && value <= 7) {
    return [
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "SUNDAY",
    ][value - 1];
  }
  if (typeof value !== "string") return value;
  const normalized = value.trim().toUpperCase();
  const dayAliases: Array<[RegExp, string]> = [
    [/^(?:1|MON(?:DAY)?|星期一|周一|礼拜一)$/, "MONDAY"],
    [/^(?:2|TUE(?:S|SDAY)?|星期二|周二|礼拜二)$/, "TUESDAY"],
    [/^(?:3|WED(?:NESDAY)?|星期三|周三|礼拜三)$/, "WEDNESDAY"],
    [/^(?:4|THU(?:R|RSDAY)?|星期四|周四|礼拜四)$/, "THURSDAY"],
    [/^(?:5|FRI(?:DAY)?|星期五|周五|礼拜五)$/, "FRIDAY"],
    [/^(?:6|SAT(?:URDAY)?|星期六|周六|礼拜六)$/, "SATURDAY"],
    [/^(?:7|SUN(?:DAY)?|星期日|星期天|周日|周天|礼拜日)$/, "SUNDAY"],
  ];
  return dayAliases.find(([pattern]) => pattern.test(normalized))?.[1] ?? value;
}

function normalizeWeeks(value: unknown) {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map(positiveInteger)
          .filter((week): week is number => week !== null && week <= 60),
      ),
    ].sort((left, right) => left - right);
  }
  if (typeof value !== "string") return [];
  const numbers = [...value.matchAll(/\d+/g)]
    .map((match) => Number(match[0]))
    .filter((week) => week > 0 && week <= 60);
  return [...new Set(numbers)].sort((left, right) => left - right);
}

function normalizeWeekPattern(value: unknown, sourceText: string) {
  const normalized =
    typeof value === "string" ? value.trim().toUpperCase() : "";
  if (
    ["ODD", "ODD_WEEKS", "单周"].includes(normalized) ||
    /单周/.test(sourceText)
  )
    return "ODD";
  if (
    ["EVEN", "EVEN_WEEKS", "双周"].includes(normalized) ||
    /双周/.test(sourceText)
  )
    return "EVEN";
  if (["CUSTOM", "SPECIFIC"].includes(normalized)) return "CUSTOM";
  return "ALL";
}

function normalizeConfidence(value: unknown) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace("%", ""))
        : NaN;
  if (!Number.isFinite(numeric)) return 0.5;
  return Math.min(1, Math.max(0, numeric > 1 ? numeric / 100 : numeric));
}

function normalizeCourse(value: unknown) {
  const source = record(value);
  if (!source) return value;
  const rawTime = first(source, [
    "time",
    "timeRange",
    "time_range",
    "classTime",
  ]);
  const [rangeStartTime, rangeEndTime] = timePair(rawTime);
  const rawPeriod = first(source, [
    "period",
    "periods",
    "periodRange",
    "period_range",
    "classPeriod",
  ]);
  const [rangeStartPeriod, rangeEndPeriod] = pair(
    rawPeriod,
    /(?:第\s*)?(\d+)(?:\s*[-–—~至到]\s*(\d+))?\s*(?:节|periods?)?/i,
  );
  const rawWeeks = first(source, [
    "weeks",
    "weekNumbers",
    "week_numbers",
    "weekRange",
    "week_range",
  ]);
  const [rangeStartWeek, rangeEndWeek] = pair(
    rawWeeks,
    /(\d+)(?:\s*[-–—~至到]\s*(\d+))?\s*(?:周|weeks?)?/i,
  );
  const sourceText = Object.values(source)
    .filter((item): item is string => typeof item === "string")
    .join(" ");
  const explicitWeeks = first(source, ["weeks", "weekNumbers", "week_numbers"]);
  const weeks =
    typeof explicitWeeks === "string" &&
    /[-–—~至到]/.test(explicitWeeks) &&
    !/[,，]/.test(explicitWeeks)
      ? []
      : normalizeWeeks(explicitWeeks);
  const weekPattern = normalizeWeekPattern(
    first(source, ["weekPattern", "week_pattern", "recurrence"]),
    sourceText,
  );

  return {
    courseName:
      nullableText(
        first(source, [
          "courseName",
          "course_name",
          "course",
          "subject",
          "name",
          "课程",
        ]),
      ) ?? "",
    teacher: nullableText(
      first(source, ["teacher", "instructor", "professor", "lecturer", "教师"]),
    ),
    dayOfWeek: normalizeDay(
      first(source, ["dayOfWeek", "day_of_week", "weekday", "day", "星期"]),
    ),
    specificDate:
      nullableText(
        first(source, ["specificDate", "specific_date", "date"]),
      )?.replaceAll("/", "-") ?? null,
    startPeriod:
      positiveInteger(first(source, ["startPeriod", "start_period"])) ??
      rangeStartPeriod,
    endPeriod:
      positiveInteger(first(source, ["endPeriod", "end_period"])) ??
      rangeEndPeriod,
    startTime:
      normalizedTime(first(source, ["startTime", "start_time"])) ??
      rangeStartTime,
    endTime:
      normalizedTime(first(source, ["endTime", "end_time"])) ?? rangeEndTime,
    room: nullableText(
      first(source, ["room", "classroom", "location", "教室"]),
    ),
    building: nullableText(first(source, ["building", "buildingName"])),
    campus: nullableText(first(source, ["campus", "campusName"])),
    startWeek:
      positiveInteger(first(source, ["startWeek", "start_week"])) ??
      rangeStartWeek,
    endWeek:
      positiveInteger(first(source, ["endWeek", "end_week"])) ?? rangeEndWeek,
    weekPattern: weeks.length > 0 ? "CUSTOM" : weekPattern,
    weeks,
    language: nullableText(first(source, ["language", "lang"])),
    notes: nullableText(first(source, ["notes", "note", "remarks"])),
    confidence: normalizeConfidence(
      first(source, ["confidence", "confidenceScore", "confidence_score"]),
    ),
    uncertainFields: Array.isArray(source.uncertainFields)
      ? source.uncertainFields.filter(
          (field): field is string => typeof field === "string",
        )
      : [],
  };
}

function extractionRoot(value: unknown) {
  if (Array.isArray(value)) return { courses: value };
  const source = record(value);
  if (!source) return {};
  for (const key of ["timetable", "schedule", "result", "data"]) {
    const nested = record(source[key]);
    if (nested && COURSE_KEYS.some((courseKey) => nested[courseKey])) {
      return nested;
    }
  }
  return source;
}

export function normalizeScheduleExtractionCandidate(value: unknown) {
  const source = extractionRoot(value);
  const courseValue = first(source, COURSE_KEYS);
  const courseRecord = record(courseValue);
  const courses = Array.isArray(courseValue)
    ? courseValue
    : courseRecord
      ? Object.values(courseRecord)
      : [];
  const rawWarnings = first(source, ["warnings", "warning"]);
  const warnings = Array.isArray(rawWarnings)
    ? rawWarnings.filter(
        (warning): warning is string => typeof warning === "string",
      )
    : typeof rawWarnings === "string" && rawWarnings.trim()
      ? [rawWarnings.trim()]
      : [];

  return {
    title: nullableText(first(source, ["title", "name", "semester"])),
    courses: courses.map(normalizeCourse),
    warnings,
  };
}
