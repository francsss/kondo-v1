"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Status = "DRAFT" | "REVIEW" | "PUBLISHED";

const ACTIONS: Record<
  Status,
  readonly { target: Status; label: string; variant?: "secondary" }[]
> = {
  DRAFT: [{ target: "REVIEW", label: "Submit for review" }],
  REVIEW: [
    { target: "PUBLISHED", label: "Publish" },
    { target: "DRAFT", label: "Send back to draft", variant: "secondary" },
  ],
  PUBLISHED: [
    { target: "DRAFT", label: "Revise (back to draft)", variant: "secondary" },
  ],
};

export function CityHubStatusActions({
  hubId,
  status,
  version,
}: {
  hubId: string;
  status: Status;
  version: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Status | null>(null);
  const [error, setError] = useState("");

  async function transition(target: Status) {
    setError("");
    setPending(target);
    const response = await fetch(`/api/admin/city-hubs/${hubId}/status`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: target, expectedVersion: version }),
    });
    const data = await response.json().catch(() => null);
    setPending(null);
    if (!response.ok) {
      setError(data?.error ?? "Could not change the status.");
      return;
    }
    router.refresh();
  }

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-black text-kondo-ink dark:text-white">
          Editorial status
        </h2>
        <span
          className={
            status === "PUBLISHED"
              ? "rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
              : status === "REVIEW"
                ? "rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"
                : "rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500 dark:bg-white/10 dark:text-slate-300"
          }
        >
          {status}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Draft → Review → Published. Only administrators can publish. Publishing
        overwrites the live public snapshot; sending a hub back to draft leaves
        the last published version live while you revise.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {ACTIONS[status].map((action) => (
          <Button
            disabled={pending !== null}
            key={action.target}
            onClick={() => transition(action.target)}
            type="button"
            variant={action.variant}
          >
            {pending === action.target ? "Working…" : action.label}
          </Button>
        ))}
      </div>
      {error ? (
        <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
