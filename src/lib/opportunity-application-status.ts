import type { OpportunityApplicationStatus } from "@prisma/client";

/**
 * Centralized application status machine, keyed by actor.
 *
 * Neither party can set an arbitrary status: an applicant cannot shortlist or
 * offer themselves, and a reviewer cannot withdraw on the applicant's behalf or
 * edit a withdrawn application.
 */

export type OpportunityApplicationActor = "APPLICANT" | "REVIEWER" | "SYSTEM";

const APPLICANT_TRANSITIONS: Record<
  OpportunityApplicationStatus,
  readonly OpportunityApplicationStatus[]
> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["WITHDRAWN"],
  UNDER_REVIEW: ["WITHDRAWN"],
  // Responding to an information request returns the application to review.
  MORE_INFORMATION_REQUIRED: ["UNDER_REVIEW", "WITHDRAWN"],
  SHORTLISTED: ["WITHDRAWN"],
  INTERVIEW: ["WITHDRAWN"],
  OFFERED: ["ACCEPTED", "DECLINED_BY_APPLICANT"],
  ACCEPTED: [],
  DECLINED_BY_APPLICANT: [],
  REJECTED: [],
  WITHDRAWN: [],
  EXPIRED: [],
  CANCELLED: [],
};

const REVIEWER_TRANSITIONS: Record<
  OpportunityApplicationStatus,
  readonly OpportunityApplicationStatus[]
> = {
  // A reviewer never sees, and never acts on, an applicant's draft.
  DRAFT: [],
  SUBMITTED: [
    "UNDER_REVIEW",
    "MORE_INFORMATION_REQUIRED",
    "SHORTLISTED",
    "REJECTED",
    "CANCELLED",
  ],
  UNDER_REVIEW: [
    "MORE_INFORMATION_REQUIRED",
    "SHORTLISTED",
    "INTERVIEW",
    "OFFERED",
    "REJECTED",
    "CANCELLED",
  ],
  MORE_INFORMATION_REQUIRED: ["UNDER_REVIEW", "REJECTED", "CANCELLED"],
  SHORTLISTED: [
    "INTERVIEW",
    "OFFERED",
    "REJECTED",
    "MORE_INFORMATION_REQUIRED",
    "CANCELLED",
  ],
  INTERVIEW: ["OFFERED", "REJECTED", "SHORTLISTED", "CANCELLED"],
  OFFERED: ["REJECTED", "CANCELLED"],
  ACCEPTED: [],
  DECLINED_BY_APPLICANT: [],
  // A rejection is not silently reversible; restoring one is a support action.
  REJECTED: [],
  WITHDRAWN: [],
  EXPIRED: [],
  CANCELLED: [],
};

const SYSTEM_TRANSITIONS: Record<
  OpportunityApplicationStatus,
  readonly OpportunityApplicationStatus[]
> = {
  DRAFT: ["EXPIRED"],
  SUBMITTED: [],
  UNDER_REVIEW: [],
  MORE_INFORMATION_REQUIRED: [],
  SHORTLISTED: [],
  INTERVIEW: [],
  OFFERED: ["EXPIRED"],
  ACCEPTED: [],
  DECLINED_BY_APPLICANT: [],
  REJECTED: [],
  WITHDRAWN: [],
  EXPIRED: [],
  CANCELLED: [],
};

const TRANSITIONS: Record<
  OpportunityApplicationActor,
  Record<OpportunityApplicationStatus, readonly OpportunityApplicationStatus[]>
> = {
  APPLICANT: APPLICANT_TRANSITIONS,
  REVIEWER: REVIEWER_TRANSITIONS,
  SYSTEM: SYSTEM_TRANSITIONS,
};

export class OpportunityApplicationStatusError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
    this.name = "OpportunityApplicationStatusError";
  }
}

export function canTransitionApplication(input: {
  actor: OpportunityApplicationActor;
  from: OpportunityApplicationStatus;
  to: OpportunityApplicationStatus;
}) {
  return TRANSITIONS[input.actor][input.from].includes(input.to);
}

export function assertApplicationTransition(input: {
  actor: OpportunityApplicationActor;
  from: OpportunityApplicationStatus;
  to: OpportunityApplicationStatus;
}) {
  if (!canTransitionApplication(input)) {
    throw new OpportunityApplicationStatusError(
      `An application cannot move from ${input.from} to ${input.to}.`,
    );
  }
}

/** A submitted application's answers become immutable to both parties. */
export function applicationAnswersEditable(
  status: OpportunityApplicationStatus,
) {
  return status === "DRAFT" || status === "MORE_INFORMATION_REQUIRED";
}

export function applicationIsTerminal(status: OpportunityApplicationStatus) {
  return (
    status === "ACCEPTED" ||
    status === "DECLINED_BY_APPLICANT" ||
    status === "REJECTED" ||
    status === "WITHDRAWN" ||
    status === "EXPIRED" ||
    status === "CANCELLED"
  );
}

export function applicationStatusLabel(status: OpportunityApplicationStatus) {
  const labels: Record<OpportunityApplicationStatus, string> = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    UNDER_REVIEW: "Under review",
    MORE_INFORMATION_REQUIRED: "Action required",
    SHORTLISTED: "Shortlisted",
    INTERVIEW: "Interview",
    OFFERED: "Offer received",
    ACCEPTED: "Accepted",
    DECLINED_BY_APPLICANT: "Declined",
    REJECTED: "Not selected",
    WITHDRAWN: "Withdrawn",
    EXPIRED: "Expired",
    CANCELLED: "Cancelled",
  };
  return labels[status];
}

/**
 * Applicant-facing grouping for the application dashboard. Kept here so the
 * dashboard and the organization workspace cannot drift apart.
 */
export function applicationDashboardBucket(
  status: OpportunityApplicationStatus,
) {
  if (status === "DRAFT") return "drafts" as const;
  if (status === "MORE_INFORMATION_REQUIRED") return "action-required" as const;
  if (status === "INTERVIEW") return "interviews" as const;
  if (status === "OFFERED") return "offers" as const;
  if (status === "SUBMITTED" || status === "UNDER_REVIEW") {
    return "in-review" as const;
  }
  if (status === "SHORTLISTED") return "in-review" as const;
  return "completed" as const;
}
