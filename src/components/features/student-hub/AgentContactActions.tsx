"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  LoaderCircle,
  Mail,
  MessageCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

export function AgentContactActions({
  agentId,
  name,
  whatsapp,
  wechat,
  email,
}: {
  agentId: string;
  name: string;
  whatsapp: string | null;
  wechat: string | null;
  email: string | null;
}) {
  const [showReport, setShowReport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const whatsappUrl = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, "")}`
    : null;

  async function report(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    const response = await fetch(
      `/api/student-hub/scholarship-agents/${agentId}/report`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: form.get("reason"),
          details: form.get("details"),
        }),
      },
    );
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "The report could not be sent.");
      return;
    }
    setMessage("Report sent to the Kondo safety team.");
    setShowReport(false);
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {whatsappUrl ? (
          <Button asChild size="sm">
            <a href={whatsappUrl} rel="noreferrer" target="_blank">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          </Button>
        ) : null}
        {email ? (
          <Button asChild size="sm" variant="secondary">
            <a href={`mailto:${email}`}>
              <Mail className="h-4 w-4" />
              Email
            </a>
          </Button>
        ) : null}
        {wechat ? (
          <Button
            onClick={async () => {
              await navigator.clipboard.writeText(wechat);
              setMessage("WeChat ID copied.");
            }}
            size="sm"
            variant="secondary"
          >
            <Copy className="h-4 w-4" />
            WeChat
          </Button>
        ) : null}
        <Button onClick={() => setShowReport(true)} size="sm" variant="ghost">
          <AlertTriangle className="h-4 w-4" />
          Report
        </Button>
      </div>
      {message ? (
        <p className="mt-3 flex items-center gap-1 text-xs font-bold text-kondo-green">
          <Check className="h-3.5 w-3.5" />
          {message}
        </p>
      ) : null}
      {showReport ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-kondo-navy/65 p-4 backdrop-blur-sm">
          <form
            className="w-full max-w-md rounded-4xl border border-border bg-card p-6 shadow-2xl"
            onSubmit={report}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">
                  Safety report
                </p>
                <h2 className="mt-1 text-xl font-black">Report {name}</h2>
              </div>
              <Button
                aria-label="Close report form"
                onClick={() => setShowReport(false)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-black">Reason</span>
              <select
                className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
                name="reason"
              >
                <option value="SCAM">Suspected scam</option>
                <option value="SPAM">Spam</option>
                <option value="HARASSMENT">Harassment</option>
                <option value="INAPPROPRIATE">Inappropriate conduct</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-black">Details</span>
              <textarea
                className="min-h-28 w-full rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:border-kondo-green"
                minLength={10}
                name="details"
                required
              />
            </label>
            {error ? (
              <p
                className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <Button className="mt-5" disabled={busy} fullWidth type="submit">
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              Send report
            </Button>
          </form>
        </div>
      ) : null}
    </>
  );
}
