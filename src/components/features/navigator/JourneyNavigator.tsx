"use client";

import Link from "next/link";
import { Check, ChevronRight, Clock3, Compass, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { KondoJourneyGroup, KondoJourneyStage } from "@prisma/client";
import type { NavigatorAction } from "@/features/navigator/registry";
import {
  JOURNEY_GROUP_PRESENTATION,
  JOURNEY_GROUPS,
  JOURNEY_STAGES_BY_GROUP,
  journeyStageLabel,
} from "@/lib/journey";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { cn } from "@/lib/utils";

type Journey = {
  group: KondoJourneyGroup;
  stage: KondoJourneyStage;
  updatedAt: string | null;
};

export function JourneyNavigator({
  initialJourney,
  initialActions,
}: {
  initialJourney: Journey;
  initialActions: NavigatorAction[];
}) {
  const [journey, setJourney] = useState(initialJourney);
  const [draft, setDraft] = useState(initialJourney);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actions, setActions] = useState(initialActions);
  const [error, setError] = useState("");

  useEffect(() => {
    captureProductEvent(PRODUCT_EVENTS.JOURNEY_VIEWED, {
      journey_group: initialJourney.group,
      journey_stage: initialJourney.stage,
    });
    captureProductEvent(PRODUCT_EVENTS.NAVIGATOR_VIEWED, {
      action_count: initialActions.length,
    });
    captureProductEvent(PRODUCT_EVENTS.PERSONALIZED_HOME_VIEWED, {
      journey_group: initialJourney.group,
    });
  }, [initialActions.length, initialJourney.group, initialJourney.stage]);

  async function saveJourney() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/journey", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group: draft.group, stage: draft.stage }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error ?? "Your journey could not be updated.");
      setJourney(data.journey);
      setEditing(false);
      window.location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your journey could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateAction(
    action: NavigatorAction,
    state: "COMPLETED" | "DISMISSED" | "DEFERRED",
  ) {
    const previous = actions;
    setActions((current) => current.filter(({ key }) => key !== action.key));
    const response = await fetch(
      `/api/navigator/actions/${encodeURIComponent(action.key)}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state,
          deferDays: state === "DEFERRED" ? 3 : undefined,
        }),
      },
    ).catch(() => null);
    if (!response?.ok) setActions(previous);
  }

  const presentation = JOURNEY_GROUP_PRESENTATION[journey.group];
  return (
    <section
      className="mt-7 grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
      aria-label="Your Kondo journey and Navigator"
    >
      <div className="rounded-[28px] border border-emerald-100 bg-gradient-to-br from-white via-white to-kondo-mint/70 p-5 shadow-soft dark:border-emerald-400/10 dark:from-card dark:via-card dark:to-emerald-400/5">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-kondo-mint text-2xl dark:bg-emerald-400/10">
            {presentation.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-kondo-green">
              Your journey
            </p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-kondo-ink dark:text-white">
              {presentation.label}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {journeyStageLabel(journey.stage)}
            </p>
          </div>
          <button
            aria-label="Update your journey"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={() => {
              setDraft(journey);
              setEditing((value) => !value);
            }}
            type="button"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Kondo uses this context to prioritize real tools and resources. Your
          stage only changes when you confirm it.
        </p>
        {editing ? (
          <div className="mt-5 border-t border-border/70 pt-5">
            <div className="grid gap-2">
              {JOURNEY_GROUPS.map((group) => (
                <button
                  className={cn(
                    "rounded-2xl border px-3 py-2.5 text-left text-xs font-bold",
                    draft.group === group
                      ? "border-kondo-green bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
                      : "border-border bg-background text-muted-foreground",
                  )}
                  key={group}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      group,
                      stage: JOURNEY_STAGES_BY_GROUP[group][0],
                    })
                  }
                  type="button"
                >
                  {JOURNEY_GROUP_PRESENTATION[group].label}
                </button>
              ))}
            </div>
            <label
              className="mt-4 block text-xs font-black text-kondo-ink dark:text-white"
              htmlFor="journey-stage"
            >
              Current stage
            </label>
            <select
              className="mt-2 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-kondo-green"
              id="journey-stage"
              onChange={(event) =>
                setDraft({
                  ...draft,
                  stage: event.target.value as KondoJourneyStage,
                })
              }
              value={draft.stage}
            >
              {JOURNEY_STAGES_BY_GROUP[draft.group].map((stage) => (
                <option key={stage} value={stage}>
                  {journeyStageLabel(stage)}
                </option>
              ))}
            </select>
            {error ? (
              <p
                className="mt-3 text-xs font-semibold text-red-600"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-full px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
                onClick={() => setEditing(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-kondo-green px-4 py-2 text-xs font-black text-white disabled:opacity-60"
                disabled={
                  saving ||
                  (draft.group === journey.group &&
                    draft.stage === journey.stage)
                }
                onClick={saveJourney}
                type="button"
              >
                {saving ? "Saving…" : "Confirm update"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-[28px] border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-kondo-navy text-kondo-lime">
            <Compass className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              Kondo Navigator
            </p>
            <h2 className="font-black text-kondo-ink dark:text-white">
              Useful next steps
            </h2>
          </div>
        </div>
        {actions.length ? (
          <div className="mt-4 divide-y divide-border/70">
            {actions.map((action) => (
              <div
                className="group flex gap-3 py-3 first:pt-0 last:pb-0"
                key={action.key}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide",
                        action.priority === "REQUIRED"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300"
                          : "bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300",
                      )}
                    >
                      {action.priority === "REQUIRED"
                        ? "Needs attention"
                        : "Recommended"}
                    </span>
                  </div>
                  <Link
                    className="mt-1.5 inline-flex items-center gap-1 text-sm font-black text-kondo-ink hover:text-kondo-green dark:text-white"
                    href={action.href}
                    onClick={() =>
                      captureProductEvent(
                        PRODUCT_EVENTS.NAVIGATOR_ACTION_OPENED,
                        { action_key: action.key },
                      )
                    }
                  >
                    {action.title}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {action.reason}
                  </p>
                </div>
                <div className="flex shrink-0 items-start gap-1">
                  <button
                    aria-label={`Mark ${action.title} complete`}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-kondo-mint hover:text-kondo-green"
                    onClick={() => updateAction(action, "COMPLETED")}
                    type="button"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    aria-label={`Remind me later about ${action.title}`}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => updateAction(action, "DEFERRED")}
                    type="button"
                  >
                    <Clock3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    aria-label={`Dismiss ${action.title}`}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => updateAction(action, "DISMISSED")}
                    type="button"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-2xl bg-muted/60 px-4 py-5 text-sm leading-6 text-muted-foreground">
            You are up to date. Kondo will show a next step when a real action
            becomes relevant.
          </p>
        )}
      </div>
    </section>
  );
}
