"use client";

import { useState } from "react";
import { Bookmark, Check, Flag, Share2, X } from "lucide-react";

function readError(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string") return error;
  }
  return "The action could not be completed.";
}

export function OpportunityPublicActions({
  opportunityId,
  title,
  signedIn,
  initiallySaved,
}: {
  opportunityId: string;
  title: string;
  signedIn: boolean;
  initiallySaved: boolean;
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("SCAM");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function requireAccount() {
    if (signedIn) return true;
    window.location.assign(
      `/login?next=${encodeURIComponent(location.pathname)}`,
    );
    return false;
  }

  async function toggleSave() {
    if (!requireAccount() || busy) return;
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/opportunities/${opportunityId}/save`, {
      method: saved ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: saved ? undefined : JSON.stringify({}),
    });
    const payload = (await response.json()) as unknown;
    if (response.ok) setSaved(!saved);
    else setMessage(readError(payload));
    setBusy(false);
  }

  async function share() {
    const data = { title, url: window.location.href };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else {
      await navigator.clipboard.writeText(data.url);
      setMessage("Link copied.");
    }
  }

  async function report() {
    if (!requireAccount() || busy) return;
    setBusy(true);
    const response = await fetch(`/api/opportunities/${opportunityId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, details: details || null }),
    });
    const payload = (await response.json()) as unknown;
    if (response.ok) {
      setMessage("Report received. Thank you for helping keep Kondo safe.");
      setReportOpen(false);
    } else setMessage(readError(payload));
    setBusy(false);
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void toggleSave()}
          className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-bold transition hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
        >
          {saved ? (
            <Check className="h-4 w-4 text-kondo-green" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
          {saved ? "Saved" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => void share()}
          className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-bold transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
        <button
          type="button"
          onClick={() => (signedIn ? setReportOpen(true) : requireAccount())}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-muted-foreground transition hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-400/10"
        >
          <Flag className="h-4 w-4" /> Report
        </button>
      </div>
      {message ? (
        <p
          role="status"
          className="mt-2 text-xs font-semibold text-muted-foreground"
        >
          {message}
        </p>
      ) : null}

      {reportOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setReportOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-[28px] bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="report-title" className="text-xl font-black">
                  Report opportunity
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Reports are confidential and reviewed by Kondo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                aria-label="Close report form"
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-5 block text-sm font-bold">
              Reason
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-black/10 bg-background px-4 py-3 font-normal dark:border-white/10"
              >
                <option value="SCAM">Possible scam</option>
                <option value="SPAM">Spam</option>
                <option value="HARASSMENT">Harassment</option>
                <option value="INAPPROPRIATE">Inappropriate content</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="mt-4 block text-sm font-bold">
              Details{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
              <textarea
                rows={4}
                maxLength={1000}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal dark:border-white/10"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void report()}
              className="mt-5 w-full rounded-full bg-kondo-green px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              Submit report
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
