"use client";

import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveState = "idle" | "saving" | "success" | "error";

export function SaveButtonLabel({
  state,
  idleLabel,
  successLabel = "Saved",
}: {
  state: SaveState;
  idleLabel: string;
  successLabel?: string;
}) {
  if (state === "saving") {
    return (
      <>
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        Saving…
      </>
    );
  }
  if (state === "success") {
    return (
      <>
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        {successLabel}
      </>
    );
  }
  return <>{idleLabel}</>;
}

export function SaveFeedback({
  state,
  message,
}: {
  state: SaveState;
  message: string;
}) {
  if (!message || (state !== "success" && state !== "error")) return null;

  const success = state === "success";
  const Icon = success ? CheckCircle2 : XCircle;

  return (
    <div
      aria-live={success ? "polite" : "assertive"}
      className={cn(
        "fixed bottom-6 right-4 z-[90] flex max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl sm:right-6 sm:max-w-md",
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-950 dark:text-emerald-200"
          : "border-red-200 bg-red-50 text-red-800 dark:border-red-400/30 dark:bg-red-950 dark:text-red-200",
      )}
      role={success ? "status" : "alert"}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
