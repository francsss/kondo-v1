import type { ZodError, ZodIssue } from "zod";

export type TimetableValidationError = {
  path: string;
  message: string;
};

function courseLabel(issue: ZodIssue) {
  const index =
    issue.path[0] === "courses" && typeof issue.path[1] === "number"
      ? issue.path[1]
      : null;
  return index === null ? null : `Course ${index + 1}`;
}

function actionableMessage(issue: ZodIssue) {
  const label = courseLabel(issue);
  const field = issue.path.at(-1);

  if (issue.path[0] === "courses" && issue.path.length === 1) {
    return "No valid courses were found in the timetable.";
  }
  if (issue.path[0] === "title") {
    return "Add a timetable name containing at least two characters.";
  }
  if (label && field === "courseName") {
    return `${label} has no course name.`;
  }
  if (label && field === "dayOfWeek") {
    return `${label} is missing a valid weekday.`;
  }
  if (
    label &&
    ["startTime", "endTime", "startPeriod", "endPeriod"].includes(String(field))
  ) {
    return `${label}: ${issue.message}`;
  }
  if (label && ["startWeek", "endWeek", "weeks"].includes(String(field))) {
    return `${label}: ${issue.message}`;
  }
  return label ? `${label}: ${issue.message}` : issue.message;
}

export function describeTimetableValidation(error: ZodError) {
  const issues: TimetableValidationError[] = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: actionableMessage(issue),
  }));
  return {
    code: "TIMETABLE_VALIDATION_FAILED",
    message:
      issues[0]?.message ??
      "The timetable could not be validated because no structured schedule was provided.",
    issues,
  } as const;
}
