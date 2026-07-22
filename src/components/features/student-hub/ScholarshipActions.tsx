"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

const statuses = [
  "SAVED",
  "PREPARING",
  "APPLIED",
  "INTERVIEW",
  "ACCEPTED",
  "REJECTED",
] as const;

export function ScholarshipActions({
  id,
  initialStatus,
}: {
  id: string;
  initialStatus: (typeof statuses)[number] | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  async function update(next: (typeof statuses)[number] | null) {
    setBusy(true);
    const response = await fetch(
      `/api/student-hub/scholarships/${id}`,
      next
        ? {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: next }),
          }
        : { method: "DELETE" },
    );
    setBusy(false);
    if (response.ok) {
      setStatus(next);
      router.refresh();
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        disabled={busy}
        onClick={() => update(status ? null : "SAVED")}
        size="sm"
        variant={status ? "primary" : "secondary"}
      >
        {busy ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : status ? (
          <Check className="h-4 w-4" />
        ) : (
          <Bookmark className="h-4 w-4" />
        )}
        {status ? "Saved" : "Save"}
      </Button>
      {status ? (
        <select
          aria-label="Application status"
          className="h-9 rounded-full border border-border bg-background px-3 text-xs font-bold"
          onChange={(event) =>
            update(event.target.value as (typeof statuses)[number])
          }
          value={status}
        >
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item[0]}
              {item.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
