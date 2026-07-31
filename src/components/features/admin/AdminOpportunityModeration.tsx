"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

const ACTIONS = [
  ["APPROVE", "Approve and publish"],
  ["REJECT", "Reject"],
  ["PAUSE", "Pause"],
  ["REMOVE", "Remove"],
  ["RESTORE", "Return to review"],
  ["BLOCK_EXTERNAL_SOURCE", "Block external link"],
] as const;

export function AdminOpportunityModeration({
  opportunityId,
}: {
  opportunityId: string;
}) {
  const router = useRouter();
  const [action, setAction] = useState("APPROVE");
  const [publisherNote, setPublisherNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const response = await fetch(
      `/api/admin/opportunities/${opportunityId}/moderate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          publisherVisibleNote: publisherNote || null,
          internalNote: internalNote || null,
        }),
      },
    );
    const payload = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? "Moderation decision saved."
        : (payload.error ?? "The decision could not be saved."),
    );
    if (response.ok) router.refresh();
    setBusy(false);
  }

  return (
    <section className="mt-8 rounded-3xl border border-black/10 p-5 dark:border-white/10">
      <h2 className="text-lg font-black">Moderation</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Action
          <select
            value={action}
            onChange={(event) => setAction(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-black/10 bg-background px-4 py-3 font-normal dark:border-white/10"
          >
            {ACTIONS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <span />
        <label className="text-sm font-bold">
          Publisher-visible note
          <textarea
            rows={4}
            value={publisherNote}
            onChange={(event) => setPublisherNote(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal dark:border-white/10"
          />
        </label>
        <label className="text-sm font-bold">
          Internal note
          <textarea
            rows={4}
            value={internalNote}
            onChange={(event) => setInternalNote(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-3 font-normal dark:border-amber-400/20 dark:bg-amber-400/5"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-kondo-green px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}Apply
        decision
      </button>
      {message ? (
        <p role="status" className="mt-3 text-sm font-semibold">
          {message}
        </p>
      ) : null}
    </section>
  );
}
