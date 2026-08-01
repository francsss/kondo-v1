import type {
  OpportunityLifecycleStatus,
  OpportunityType,
} from "@prisma/client";
import {
  hasOrganizationPermission,
  type OrganizationMembershipContext,
  type OrganizationPermission,
} from "@/lib/organization-authorization";
import { organizationAllowsPublishing } from "@/lib/organization-lifecycle";
import { canTransitionOpportunity } from "@/lib/opportunity-lifecycle";
import { opportunityCapabilityFor } from "@/lib/opportunity-types";

/**
 * Publisher-side lifecycle actions for one opportunity, resolved from the rules
 * that already govern the API.
 *
 * Part 5 shipped the transition endpoint and a complete lifecycle map, but the
 * workspace only ever offered "Submit for review". Publishing, pausing,
 * resuming, closing and archiving were unreachable, and an opportunity sitting
 * in PENDING_REVIEW gave the member no indication that a Kondo moderator now
 * owns the next step — which is what "publishing is blocked with no
 * explanation" actually was.
 *
 * Nothing here decides authorization. The same permission, capability and
 * lifecycle checks run again server-side in `transitionOrganizationOpportunity`;
 * this module exists so the workspace shows the truth instead of a button that
 * fails.
 */

export type OpportunityWorkspaceAction =
  "SUBMIT" | "PUBLISH" | "PAUSE" | "CLOSE" | "ARCHIVE";

const ACTION_TARGET: Record<
  OpportunityWorkspaceAction,
  OpportunityLifecycleStatus
> = {
  SUBMIT: "PENDING_REVIEW",
  PUBLISH: "PUBLISHED",
  PAUSE: "PAUSED",
  CLOSE: "CLOSED",
  ARCHIVE: "ARCHIVED",
};

const ACTION_PERMISSION: Record<
  OpportunityWorkspaceAction,
  OrganizationPermission
> = {
  SUBMIT: "ORGANIZATION_SUBMIT_OPPORTUNITIES",
  PUBLISH: "ORGANIZATION_PUBLISH_OPPORTUNITIES",
  PAUSE: "ORGANIZATION_PUBLISH_OPPORTUNITIES",
  CLOSE: "ORGANIZATION_PUBLISH_OPPORTUNITIES",
  ARCHIVE: "ORGANIZATION_ARCHIVE_OPPORTUNITIES",
};

/** Actions that need the organization to be allowed to publish right now. */
const REQUIRES_PUBLISHING: ReadonlySet<OpportunityWorkspaceAction> = new Set([
  "SUBMIT",
  "PUBLISH",
]);

const ACTION_LABEL: Record<OpportunityWorkspaceAction, string> = {
  SUBMIT: "Submit for review",
  PUBLISH: "Publish",
  PAUSE: "Pause",
  CLOSE: "Close",
  ARCHIVE: "Archive",
};

export type ResolvedOpportunityAction = {
  action: OpportunityWorkspaceAction;
  label: string;
  available: boolean;
  /** Exactly why the action cannot be taken; never a generic refusal. */
  blockedReason: string | null;
  /** Archiving and closing cannot be undone by the publisher. */
  confirm: boolean;
};

export function opportunityWorkspaceActions(input: {
  lifecycle: OpportunityLifecycleStatus;
  type: OpportunityType;
  membership: OrganizationMembershipContext | null | undefined;
  organizationLifecycleStatus: string;
  enabledCapabilities: readonly string[];
  suspensionReason?: string | null;
}): ResolvedOpportunityAction[] {
  const requiredCapability = opportunityCapabilityFor(input.type);
  const hasCapability = input.enabledCapabilities.includes(requiredCapability);
  const mayPublish = organizationAllowsPublishing(
    input.organizationLifecycleStatus as Parameters<
      typeof organizationAllowsPublishing
    >[0],
  );
  const suspended = input.organizationLifecycleStatus === "SUSPENDED";

  const resolved: ResolvedOpportunityAction[] = [];
  for (const action of Object.keys(
    ACTION_TARGET,
  ) as OpportunityWorkspaceAction[]) {
    // A transition the lifecycle does not allow from here is not an error to
    // explain — it is simply not part of this state's vocabulary.
    if (
      !canTransitionOpportunity({
        actor: "PUBLISHER",
        from: input.lifecycle,
        to: ACTION_TARGET[action],
      })
    ) {
      continue;
    }

    let blockedReason: string | null = null;
    if (
      !hasOrganizationPermission(input.membership, ACTION_PERMISSION[action])
    ) {
      blockedReason =
        action === "PUBLISH"
          ? "You can edit opportunities but you do not have permission to publish them."
          : `Your membership does not include permission to ${ACTION_LABEL[action].toLowerCase()} opportunities.`;
    } else if (REQUIRES_PUBLISHING.has(action) && !hasCapability) {
      blockedReason = `This organization has not enabled the ${requiredCapability === "SCHOLARSHIPS" ? "Scholarships" : requiredCapability === "INTERNSHIPS_JOBS" ? "Internships & jobs" : requiredCapability.replaceAll("_", " ").toLowerCase()} activity area.`;
    } else if (REQUIRES_PUBLISHING.has(action) && !mayPublish) {
      blockedReason = suspended
        ? input.suspensionReason ||
          "This organization is suspended and cannot publish."
        : "This organization cannot publish while its account is not active.";
    }

    resolved.push({
      action,
      label: ACTION_LABEL[action],
      available: blockedReason === null,
      blockedReason,
      confirm: action === "ARCHIVE" || action === "CLOSE",
    });
  }
  return resolved;
}

/**
 * What the member should expect next, stated plainly. A record waiting on
 * moderation is the single most common "nothing happens when I publish"
 * report, so the state says who owns the next step.
 */
export function opportunityLifecycleGuidance(
  lifecycle: OpportunityLifecycleStatus,
): string | null {
  switch (lifecycle) {
    case "DRAFT":
      return "Only your team can see this. Submit it for review, or publish it directly if you have permission.";
    case "PENDING_REVIEW":
      return "Awaiting moderation review by Kondo. You cannot publish it yourself while it is in review.";
    case "PUBLISHED":
      return "Live and visible to students.";
    case "PAUSED":
      return "Hidden from students. Resume it to make it visible again.";
    case "REJECTED":
      return "A moderator asked for changes. Edit it and submit it again.";
    case "CLOSED":
      return "Closed to new applications. Existing applications are kept.";
    case "EXPIRED":
      return "The deadline has passed. Move it back to draft to reopen it.";
    case "REMOVED":
      return "Removed by moderation. Contact Kondo support for details.";
    case "ARCHIVED":
      return "Archived. This cannot be undone from the workspace.";
    default:
      return null;
  }
}
