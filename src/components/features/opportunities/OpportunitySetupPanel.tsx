import Link from "next/link";
import { Check, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { OpportunitySetupRequirement } from "@/lib/organization-workspace-navigation";

/**
 * Explains exactly what an organization still needs before it can publish
 * opportunities, and offers the action that satisfies each missing item.
 *
 * Shown instead of hiding the section: a member who cannot see why a feature is
 * unavailable cannot fix it, and a silently missing navigation entry is
 * indistinguishable from a broken build.
 */
export function OpportunitySetupPanel({
  requirements,
  blockedReason,
}: {
  requirements: OpportunitySetupRequirement[];
  blockedReason: string | null;
}) {
  const missing = requirements.filter((requirement) => !requirement.met);
  if (!missing.length) return null;

  return (
    <Card className="mt-6 p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-warning/15 text-warning-foreground">
          <Lock aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-black">Setup required</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {blockedReason ??
              "Finish the items below to publish opportunities from this organization."}
          </p>
        </div>
      </div>

      <ul className="mt-5 grid gap-2">
        {requirements.map((requirement) => (
          <li
            className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted/60 px-3.5 py-3"
            key={requirement.key}
          >
            {requirement.met ? (
              <Check
                aria-label="Complete"
                className="h-4 w-4 shrink-0 text-kondo-green"
              />
            ) : (
              <X
                aria-label="Not complete"
                className="h-4 w-4 shrink-0 text-muted-foreground"
              />
            )}
            <span className="min-w-0 flex-1 text-sm font-semibold">
              {requirement.label}
            </span>
            {!requirement.met && requirement.actionHref ? (
              <Button asChild size="sm" variant="secondary">
                <Link href={requirement.actionHref}>
                  {requirement.actionLabel ?? "Open"}
                </Link>
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
