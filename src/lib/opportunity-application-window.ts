import type {
  OpportunityApplicationMethod,
  OpportunityLifecycleStatus,
} from "@prisma/client";

/**
 * Server-side application-window resolver.
 *
 * The client clock is never trusted: every window decision is computed from
 * server time and re-checked transactionally at submission. "Closing soon" uses
 * the fixed threshold below rather than an invented sense of urgency, and no
 * live countdown is derived from this state — only a date, a timezone and a
 * label, so a sleeping device or a timezone change cannot make it wrong.
 */

export const CLOSING_SOON_THRESHOLD_DAYS = 7;

export type OpportunityApplicationWindowState =
  | "NOT_OPEN"
  | "OPEN"
  | "CLOSING_SOON"
  | "CLOSED"
  | "ROLLING"
  | "EXTERNAL_ONLY"
  | "INFORMATION_ONLY";

export type OpportunityApplicationWindow = {
  state: OpportunityApplicationWindowState;
  /** Whether Kondo itself accepts an application right now. */
  acceptsKondoApplications: boolean;
  /** Whether the user is sent to a provider surface instead. */
  redirectsExternally: boolean;
  opensAt: Date | null;
  deadline: Date | null;
  timezone: string;
  rolling: boolean;
  daysUntilDeadline: number | null;
};

type WindowInput = {
  lifecycle: OpportunityLifecycleStatus;
  applicationMethod: OpportunityApplicationMethod;
  applicationOpenAt?: Date | string | null;
  applicationDeadline?: Date | string | null;
  rollingApplications?: boolean;
  timezone?: string | null;
  now?: Date;
};

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function wholeDaysBetween(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
}

export function resolveApplicationWindow(
  input: WindowInput,
): OpportunityApplicationWindow {
  const now = input.now ?? new Date();
  const opensAt = toDate(input.applicationOpenAt);
  const deadline = toDate(input.applicationDeadline);
  const rolling = input.rollingApplications === true;
  const timezone = input.timezone?.trim() || "Asia/Shanghai";
  const daysUntilDeadline = deadline ? wholeDaysBetween(now, deadline) : null;

  const base = {
    opensAt,
    deadline,
    timezone,
    rolling,
    daysUntilDeadline,
  };

  const closed = (state: OpportunityApplicationWindowState) => ({
    ...base,
    state,
    acceptsKondoApplications: false,
    redirectsExternally: false,
  });

  if (input.applicationMethod === "INFORMATION_ONLY") {
    return closed("INFORMATION_ONLY");
  }
  // A nomination-based opportunity has no ordinary apply action at all; the
  // public page explains the nomination route instead.
  if (input.applicationMethod === "NOMINATION_REQUIRED") {
    return closed("INFORMATION_ONLY");
  }
  if (input.lifecycle !== "PUBLISHED") {
    return closed("CLOSED");
  }
  if (opensAt && opensAt > now) {
    return closed("NOT_OPEN");
  }
  if (deadline && deadline <= now) {
    return closed("CLOSED");
  }

  const external =
    input.applicationMethod === "EXTERNAL_URL" ||
    input.applicationMethod === "EMAIL";

  const openState: OpportunityApplicationWindowState = external
    ? "EXTERNAL_ONLY"
    : rolling && !deadline
      ? "ROLLING"
      : daysUntilDeadline !== null &&
          daysUntilDeadline <= CLOSING_SOON_THRESHOLD_DAYS
        ? "CLOSING_SOON"
        : "OPEN";

  return {
    ...base,
    state: openState,
    acceptsKondoApplications:
      input.applicationMethod === "KONDO_APPLICATION" && !external,
    redirectsExternally: external,
  };
}

/**
 * Authoritative gate used by the submission transaction. Kept separate from the
 * presentational state so a UI label can never be mistaken for permission.
 */
export function applicationWindowAcceptsSubmission(
  window: OpportunityApplicationWindow,
) {
  return window.acceptsKondoApplications;
}

export function applicationWindowLabel(
  window: OpportunityApplicationWindow,
): string {
  switch (window.state) {
    case "NOT_OPEN":
      return "Applications not open yet";
    case "OPEN":
      return "Applications open";
    case "CLOSING_SOON":
      return "Closing soon";
    case "CLOSED":
      return "Applications closed";
    case "ROLLING":
      return "Rolling applications";
    case "EXTERNAL_ONLY":
      return "Apply on the provider’s site";
    case "INFORMATION_ONLY":
      return "Information only";
  }
}
