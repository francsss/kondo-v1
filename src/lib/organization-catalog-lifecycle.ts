import type {
  OrganizationProductStatus,
  OrganizationServiceStatus,
} from "@prisma/client";

type CatalogAction =
  | "SUBMIT"
  | "PUBLISH"
  | "PAUSE"
  | "RESUME"
  | "OUT_OF_STOCK"
  | "UNAVAILABLE"
  | "ARCHIVE";

const productTargets: Record<CatalogAction, OrganizationProductStatus | null> =
  {
    SUBMIT: "PENDING_REVIEW",
    PUBLISH: "PUBLISHED",
    PAUSE: "PAUSED",
    RESUME: "PUBLISHED",
    OUT_OF_STOCK: "OUT_OF_STOCK",
    UNAVAILABLE: null,
    ARCHIVE: "ARCHIVED",
  };

const serviceTargets: Record<CatalogAction, OrganizationServiceStatus | null> =
  {
    SUBMIT: "PENDING_REVIEW",
    PUBLISH: "PUBLISHED",
    PAUSE: "PAUSED",
    RESUME: "PUBLISHED",
    OUT_OF_STOCK: null,
    UNAVAILABLE: "UNAVAILABLE",
    ARCHIVE: "ARCHIVED",
  };

const productTransitions: Record<
  OrganizationProductStatus,
  readonly OrganizationProductStatus[]
> = {
  DRAFT: ["PENDING_REVIEW", "ARCHIVED"],
  PENDING_REVIEW: ["PUBLISHED", "DRAFT", "REJECTED", "ARCHIVED"],
  PUBLISHED: ["PAUSED", "OUT_OF_STOCK", "ARCHIVED", "REMOVED"],
  OUT_OF_STOCK: ["PUBLISHED", "PAUSED", "ARCHIVED", "REMOVED"],
  PAUSED: ["PUBLISHED", "OUT_OF_STOCK", "ARCHIVED", "REMOVED"],
  REJECTED: ["DRAFT", "ARCHIVED"],
  REMOVED: [],
  ARCHIVED: ["DRAFT"],
};

const serviceTransitions: Record<
  OrganizationServiceStatus,
  readonly OrganizationServiceStatus[]
> = {
  DRAFT: ["PENDING_REVIEW", "ARCHIVED"],
  PENDING_REVIEW: ["PUBLISHED", "DRAFT", "REJECTED", "ARCHIVED"],
  PUBLISHED: ["PAUSED", "UNAVAILABLE", "ARCHIVED", "REMOVED"],
  PAUSED: ["PUBLISHED", "UNAVAILABLE", "ARCHIVED", "REMOVED"],
  UNAVAILABLE: ["PUBLISHED", "PAUSED", "ARCHIVED", "REMOVED"],
  REJECTED: ["DRAFT", "ARCHIVED"],
  REMOVED: [],
  ARCHIVED: ["DRAFT"],
};

export class CatalogLifecycleError extends Error {
  constructor(
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = "CatalogLifecycleError";
  }
}

export function catalogTransitionTarget(
  input:
    | {
        kind: "product";
        from: OrganizationProductStatus;
        action: CatalogAction;
      }
    | {
        kind: "service";
        from: OrganizationServiceStatus;
        action: CatalogAction;
      },
) {
  const target =
    input.kind === "product"
      ? productTargets[input.action]
      : serviceTargets[input.action];
  if (!target) {
    throw new CatalogLifecycleError(
      `This action is not available for an organization ${input.kind}.`,
      400,
    );
  }
  const allowed =
    input.kind === "product"
      ? productTransitions[input.from].includes(
          target as OrganizationProductStatus,
        )
      : serviceTransitions[input.from].includes(
          target as OrganizationServiceStatus,
        );
  if (!allowed) {
    throw new CatalogLifecycleError(
      `A ${input.kind} cannot move from ${input.from} to ${target}.`,
    );
  }
  return target;
}
