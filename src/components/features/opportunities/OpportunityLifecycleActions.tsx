"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import type { ResolvedOpportunityAction } from "@/lib/opportunity-workspace-actions";

/**
 * Publisher lifecycle controls for one opportunity.
 *
 * A blocked action is rendered disabled with its exact reason rather than
 * hidden, so a member can see that publishing needs a permission or a
 * capability instead of concluding the button is broken. No action fails
 * silently: the server's message is surfaced verbatim.
 */
export function OpportunityLifecycleActions({
  actions,
  organizationId,
  opportunityId,
}: {
  actions: ResolvedOpportunityAction[];
  organizationId: string;
  opportunityId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  // `router.refresh()` re-renders the server component tree asynchronously.
  // Without tracking it the button would go idle while the list still showed
  // the previous lifecycle, which reads exactly like a publish that did nothing.
  const [refreshing, startRefresh] = useTransition();
  const busy = pending !== null || refreshing;

  async function run(entry: ResolvedOpportunityAction) {
    if (busy) return;
    if (entry.confirm) {
      const confirmed = window.confirm(
        `${entry.label} this opportunity? This cannot be undone from the workspace.`,
      );
      if (!confirmed) return;
    }
    setPending(entry.action);
    setError("");
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/opportunities/${opportunityId}/transition`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: entry.action }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(
          payload?.error ?? "The opportunity could not be updated.",
        );
      }
      startRefresh(() => router.refresh());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The opportunity could not be updated.",
      );
    } finally {
      setPending(null);
    }
  }

  if (!actions.length) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((entry) => (
          <Button
            disabled={!entry.available || busy}
            key={entry.action}
            onClick={() => void run(entry)}
            size="sm"
            title={entry.blockedReason ?? undefined}
            type="button"
            variant={entry.action === "PUBLISH" ? "primary" : "secondary"}
          >
            {pending === entry.action || (refreshing && pending === null)
              ? "Working…"
              : entry.label}
          </Button>
        ))}
      </div>
      {actions
        .filter((entry) => entry.blockedReason)
        .map((entry) => (
          <p
            className="mt-2 text-xs font-semibold text-muted-foreground"
            key={`${entry.action}-reason`}
          >
            {entry.label}: {entry.blockedReason}
          </p>
        ))}
      {error ? (
        <p
          className="mt-2 text-xs font-bold text-destructive"
          data-testid="opportunity-lifecycle-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
