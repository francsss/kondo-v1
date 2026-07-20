"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const statuses = [
  "DRAFT",
  "ACTIVE",
  "RESERVED",
  "SOLD",
  "ARCHIVED",
  "EXPIRED",
  "REMOVED",
];

export function MarketplaceAdminActions({
  listingId,
  initialStatus,
  initialReviewed,
}: {
  listingId: string;
  initialStatus: string;
  initialReviewed: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [reviewed, setReviewed] = useState(initialReviewed);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setPending(true);
    const response = await fetch(`/api/admin/marketplace/${listingId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        fraudReviewed: reviewed,
        ...(note.trim() ? { moderationNote: note } : {}),
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setPending(false);
    setMessage(
      response?.ok
        ? "Listing moderation saved."
        : (payload?.error ?? "Could not save."),
    );
    if (response?.ok) router.refresh();
  }

  return (
    <Card>
      <h2 className="font-black text-kondo-ink dark:text-white">Moderation</h2>
      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-bold">Status</span>
        <select
          className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
          onChange={(event) => setStatus(event.target.value)}
          value={status}
        >
          {statuses.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 flex items-center gap-3 text-sm font-semibold">
        <input
          checked={reviewed}
          onChange={(event) => setReviewed(event.target.checked)}
          type="checkbox"
        />
        Fraud signals reviewed
      </label>
      <textarea
        className="mt-4 min-h-24 w-full rounded-2xl border border-slate-200 bg-transparent p-3 text-sm dark:border-white/10"
        maxLength={1000}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional moderation note (10+ characters)"
        value={note}
      />
      {message ? (
        <p className="mt-3 text-xs text-slate-400" role="status">
          {message}
        </p>
      ) : null}
      <Button className="mt-4" disabled={pending} onClick={save} type="button">
        {pending ? "Saving…" : "Save moderation"}
      </Button>
    </Card>
  );
}
