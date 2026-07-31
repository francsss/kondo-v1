import type { HousingListingStatus } from "@prisma/client";

export class HousingLifecycleError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
    this.name = "HousingLifecycleError";
  }
}

export type HousingLifecycleActor = "PUBLISHER" | "ADMIN" | "SYSTEM";

const TRANSITIONS: Record<
  HousingListingStatus,
  Partial<Record<HousingLifecycleActor, readonly HousingListingStatus[]>>
> = {
  DRAFT: {
    PUBLISHER: ["PENDING_REVIEW", "ARCHIVED"],
    ADMIN: ["PENDING_REVIEW", "REJECTED", "REMOVED", "ARCHIVED"],
  },
  PENDING_REVIEW: {
    PUBLISHER: ["DRAFT", "ARCHIVED"],
    ADMIN: ["PUBLISHED", "REJECTED", "REMOVED"],
  },
  PUBLISHED: {
    PUBLISHER: ["PAUSED", "RENTED", "ARCHIVED"],
    ADMIN: ["PAUSED", "RENTED", "REMOVED", "ARCHIVED"],
    SYSTEM: ["EXPIRED"],
  },
  PAUSED: {
    PUBLISHER: ["PUBLISHED", "RENTED", "ARCHIVED"],
    ADMIN: ["PUBLISHED", "REJECTED", "REMOVED", "ARCHIVED"],
    SYSTEM: ["EXPIRED"],
  },
  RENTED: {
    PUBLISHER: ["ARCHIVED"],
    ADMIN: ["ARCHIVED", "REMOVED"],
  },
  EXPIRED: {
    PUBLISHER: ["DRAFT", "ARCHIVED"],
    ADMIN: ["DRAFT", "REMOVED", "ARCHIVED"],
  },
  REJECTED: {
    PUBLISHER: ["DRAFT", "ARCHIVED"],
    ADMIN: ["DRAFT", "REMOVED", "ARCHIVED"],
  },
  REMOVED: { ADMIN: ["ARCHIVED"] },
  ARCHIVED: { ADMIN: ["DRAFT"] },
};

export function housingListingTransitions(
  status: HousingListingStatus,
  actor: HousingLifecycleActor,
) {
  return TRANSITIONS[status][actor] ?? [];
}

export function assertHousingListingTransition(input: {
  from: HousingListingStatus;
  to: HousingListingStatus;
  actor: HousingLifecycleActor;
}) {
  if (!housingListingTransitions(input.from, input.actor).includes(input.to)) {
    throw new HousingLifecycleError(
      `Housing listing cannot move from ${input.from} to ${input.to}.`,
    );
  }
}

export function housingListingIsPublicStatus(status: HousingListingStatus) {
  return status === "PUBLISHED";
}

export function housingListingStatusTimestamp(
  status: HousingListingStatus,
  now = new Date(),
) {
  return {
    publishedAt: status === "PUBLISHED" ? now : undefined,
    pausedAt: status === "PAUSED" ? now : undefined,
    rentedAt: status === "RENTED" ? now : undefined,
    rejectedAt: status === "REJECTED" ? now : undefined,
    removedAt: status === "REMOVED" ? now : undefined,
    archivedAt: status === "ARCHIVED" ? now : undefined,
  };
}
