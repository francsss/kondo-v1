"use client";

import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function GuideChecklist({
  steps,
}: {
  steps: Array<{
    id: string;
    order: number;
    title: string;
    content: string;
    completed: boolean;
  }>;
}) {
  const [completed, setCompleted] = useState(
    () =>
      new Set(steps.filter((step) => step.completed).map((step) => step.id)),
  );
  const [openStep, setOpenStep] = useState<string | undefined>(
    steps.find((step) => !step.completed)?.id ?? steps[0]?.id,
  );

  async function toggleStep(stepId: string) {
    const next = new Set(completed);
    if (next.has(stepId)) next.delete(stepId);
    else next.add(stepId);
    setCompleted(next);

    const response = await fetch(`/api/guides/progress/${stepId}`, {
      method: next.has(stepId) ? "PUT" : "DELETE",
    }).catch(() => null);

    if (!response?.ok) setCompleted(completed);
  }

  return (
    <div className="space-y-3">
      {steps.map((step) => {
        const isOpen = openStep === step.id;
        const isComplete = completed.has(step.id);
        return (
          <section
            className="overflow-hidden rounded-3xl border border-border bg-card text-card-foreground"
            key={step.id}
          >
            <button
              aria-expanded={isOpen}
              className="flex w-full items-center gap-4 p-5 text-left"
              onClick={() => setOpenStep(isOpen ? undefined : step.id)}
              type="button"
            >
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black",
                  isComplete
                    ? "bg-primary text-primary-foreground"
                    : "bg-slate-100 text-muted-foreground dark:bg-white/5 dark:text-muted-foreground",
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : step.order}
              </span>
              <span
                className={cn(
                  "flex-1 font-bold",
                  isComplete
                    ? "text-muted-foreground line-through"
                    : "text-kondo-ink dark:text-white",
                )}
              >
                {step.title}
              </span>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {isOpen ? (
              <div className="border-t border-slate-100 px-5 pb-5 pl-[76px] pt-4 dark:border-white/10">
                <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">
                  {step.content}
                </p>
                <button
                  className={cn(
                    "mt-5 rounded-full px-4 py-2 text-xs font-black transition",
                    isComplete
                      ? "bg-slate-100 text-muted-foreground dark:bg-white/5"
                      : "bg-kondo-mint text-kondo-forest hover:bg-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300",
                  )}
                  onClick={() => toggleStep(step.id)}
                  type="button"
                >
                  {isComplete ? "Mark as incomplete" : "Mark step complete"}
                </button>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
