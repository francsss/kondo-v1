"use client";

import { Flag, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

export function StoryReportForm({
  storyId,
  storyTitle,
}: {
  storyId: string;
  storyTitle: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("INAPPROPRIATE");
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const response = await fetch(`/api/stories/${storyId}/report`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, details: details || null }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setPending(false);
    if (!response?.ok) {
      setError(payload?.error ?? "The report could not be submitted.");
      return;
    }
    setDone(true);
    captureProductEvent(PRODUCT_EVENTS.STORY_REPORTED, {
      story_id: storyId,
      reason,
    });
  }

  return (
    <Card className="mx-auto mt-7 max-w-2xl p-6 sm:p-8">
      {done ? (
        <div className="py-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-kondo-mint text-kondo-forest">
            <Flag className="h-5 w-5" />
          </span>
          <h2 className="mt-5 text-xl font-black">
            Thank you for protecting Kondo
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The moderation team will review this Story. Your report remains
            confidential.
          </p>
          <Button className="mt-6" onClick={() => router.back()} type="button">
            Return to Stories
          </Button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <p className="text-xs font-black uppercase tracking-wider text-kondo-green">
            Reporting
          </p>
          <h2 className="mt-2 text-xl font-black text-kondo-ink dark:text-white">
            {storyTitle}
          </h2>
          <label className="mt-6 block">
            <span className="mb-2 block text-xs font-black">Reason</span>
            <select
              className="h-11 w-full rounded-2xl border border-border bg-card px-4 text-sm"
              onChange={(event) => setReason(event.target.value)}
              value={reason}
            >
              <option value="INAPPROPRIATE">
                False, unsafe or inappropriate
              </option>
              <option value="HARASSMENT">Harassment or discrimination</option>
              <option value="SPAM">Spam or unauthorized promotion</option>
              <option value="SCAM">Scam or impersonation</option>
              <option value="OTHER">Privacy, rights or another concern</option>
            </select>
          </label>
          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-black">
              Helpful details · optional
            </span>
            <textarea
              className="min-h-28 w-full rounded-2xl border border-border bg-transparent p-4 text-sm"
              maxLength={1000}
              onChange={(event) => setDetails(event.target.value)}
              value={details}
            />
          </label>
          {error ? (
            <p className="mt-3 text-xs font-semibold text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex justify-end gap-3">
            <Button
              onClick={() => router.back()}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button disabled={pending} type="submit" variant="danger">
              {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Flag className="h-4 w-4" />
              )}
              Submit report
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
