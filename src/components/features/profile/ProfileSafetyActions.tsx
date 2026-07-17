"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Flag, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

const reasons = ["SPAM", "HARASSMENT", "SCAM", "INAPPROPRIATE", "OTHER"];

export function ProfileSafetyActions({
  userId,
  initiallyBlocked,
}: {
  userId: string;
  initiallyBlocked: boolean;
}) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const [reporting, setReporting] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function toggleBlock() {
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/users/${userId}/block`, {
        method: blocked ? "DELETE" : "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback(payload.error ?? "Block setting could not be updated.");
        return;
      }
      setBlocked(!blocked);
      setFeedback(blocked ? "Member unblocked." : "Member blocked.");
      router.refresh();
    } catch {
      setFeedback("Block setting could not be updated.");
    } finally {
      setPending(false);
    }
  }

  async function report(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/profiles/${userId}/report`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: values.get("reason"),
          details: values.get("details") || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback(payload.error ?? "Profile report could not be submitted.");
        return;
      }
      setReporting(false);
      setFeedback("Profile report submitted for review.");
    } catch {
      setFeedback("Profile report could not be submitted.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-slate-400" />
        <p className="text-xs font-black uppercase tracking-wider text-slate-400">
          Safety
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={toggleBlock}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Ban className="h-4 w-4" />
          {blocked ? "Unblock" : "Block"}
        </Button>
        <Button
          onClick={() => setReporting((value) => !value)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Flag className="h-4 w-4" /> Report
        </Button>
      </div>
      {reporting ? (
        <form className="mt-4 space-y-3" onSubmit={report}>
          <select
            className="h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
            name="reason"
          >
            {reasons.map((reason) => (
              <option key={reason} value={reason}>
                {reason[0] + reason.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <textarea
            className="min-h-24 w-full rounded-xl border border-slate-200 bg-transparent p-3 text-sm outline-none dark:border-white/10"
            maxLength={1000}
            name="details"
            placeholder="Add context for the moderation team."
          />
          <Button disabled={pending} size="sm" type="submit" variant="danger">
            Submit report
          </Button>
        </form>
      ) : null}
      {feedback ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
