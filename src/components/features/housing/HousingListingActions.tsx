"use client";

import { Bookmark, Flag, MessageCircle, Share2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

export function HousingListingActions({
  listingId,
  initialSaved,
  signedIn,
}: {
  listingId: string;
  initialSaved: boolean;
  signedIn: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [topic, setTopic] = useState("AVAILABILITY");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("SCAM");
  const [reportDetails, setReportDetails] = useState("");
  const reportButtonRef = useRef<HTMLDivElement | null>(null);
  const reportFieldRef = useRef<HTMLTextAreaElement | null>(null);
  const inquiryStarted = useRef(false);

  const restoreReportFocus = useCallback(() => {
    reportButtonRef.current?.querySelector("button")?.focus();
  }, []);

  useEffect(() => {
    if (!reportOpen) return;
    reportFieldRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setReportOpen(false);
        restoreReportFocus();
      }
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [reportOpen, restoreReportFocus]);

  async function toggleSaved() {
    if (busy) return;
    setBusy(true);
    const response = await fetch(`/api/housing/listings/${listingId}/save`, {
      method: saved ? "DELETE" : "POST",
      credentials: "include",
    });
    if (response.ok) setSaved(!saved);
    else {
      const payload = await response.json().catch(() => null);
      setFeedback(payload?.error ?? "Could not update this saved home.");
    }
    setBusy(false);
  }

  async function inquire() {
    if (busy || message.trim().length < 2) return;
    setBusy(true);
    setFeedback(null);
    const response = await fetch(
      `/api/housing/listings/${listingId}/inquiries`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, message }),
      },
    );
    const payload = await response.json().catch(() => null);
    if (response.ok) {
      setMessage("");
      setFeedback("Inquiry sent. Continue in Messages.");
    } else {
      setFeedback(payload?.error ?? "Could not send your inquiry.");
    }
    setBusy(false);
  }

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const response = await fetch(`/api/housing/listings/${listingId}/report`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: reportReason,
        details: reportDetails.trim() || null,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (response.ok) {
      setFeedback("Thank you. Kondo will review this listing.");
      setReportOpen(false);
      setReportDetails("");
      restoreReportFocus();
    } else {
      setFeedback(payload?.error ?? "Could not submit the report.");
    }
    setBusy(false);
  }

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: "Kondo Housing", url }).catch(() => null);
    } else {
      await navigator.clipboard.writeText(url);
      setFeedback("Link copied.");
    }
    captureProductEvent(PRODUCT_EVENTS.HOUSING_LISTING_SHARED);
  }

  return (
    <div className="space-y-5">
      <div className={`grid gap-2 ${signedIn ? "grid-cols-3" : "grid-cols-2"}`}>
        {signedIn ? (
          <Button
            aria-pressed={saved}
            disabled={busy}
            onClick={toggleSaved}
            size="sm"
            variant={saved ? "primary" : "secondary"}
          >
            <Bookmark aria-hidden className="h-4 w-4" />
            {saved ? "Saved" : "Save"}
          </Button>
        ) : null}
        <Button onClick={share} size="sm" variant="secondary">
          <Share2 aria-hidden className="h-4 w-4" />
          Share
        </Button>
        {signedIn ? (
          <div ref={reportButtonRef}>
            <Button
              onClick={() => setReportOpen(true)}
              size="sm"
              variant="ghost"
            >
              <Flag aria-hidden className="h-4 w-4" />
              Report
            </Button>
          </div>
        ) : (
          <Button asChild size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        )}
      </div>
      <div className="rounded-3xl border border-border bg-muted/35 p-4">
        <div className="flex items-center gap-2">
          <MessageCircle aria-hidden className="h-5 w-5 text-kondo-green" />
          <h2 className="font-display text-lg font-black">Ask the publisher</h2>
        </div>
        {!signedIn ? (
          <div className="mt-4">
            <p className="text-sm leading-6 text-muted-foreground">
              Sign in to ask about availability while keeping your contact
              details inside Kondo.
            </p>
            <Button asChild className="mt-3" fullWidth>
              <Link href="/login">Sign in to contact</Link>
            </Button>
          </div>
        ) : (
          <>
            <label className="mt-4 block">
              <span className="sr-only">Inquiry topic</span>
              <select
                className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm font-semibold"
                onChange={(event) => setTopic(event.target.value)}
                value={topic}
              >
                <option value="AVAILABILITY">Availability</option>
                <option value="VIEWING">Arrange a viewing</option>
                <option value="UTILITIES">Utilities and costs</option>
                <option value="LEASE_DURATION">Lease duration</option>
                <option value="OTHER">Other question</option>
              </select>
            </label>
            <label className="mt-3 block">
              <span className="sr-only">Message</span>
              <textarea
                className="min-h-28 w-full resize-y rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
                maxLength={1500}
                onChange={(event) => setMessage(event.target.value)}
                onFocus={() => {
                  if (inquiryStarted.current) return;
                  inquiryStarted.current = true;
                  captureProductEvent(PRODUCT_EVENTS.HOUSING_CONTACT_OPENED);
                  captureProductEvent(PRODUCT_EVENTS.HOUSING_INQUIRY_STARTED);
                }}
                placeholder="Introduce yourself and ask a clear question…"
                value={message}
              />
            </label>
            <Button
              className="mt-3"
              disabled={busy || message.trim().length < 2}
              fullWidth
              onClick={inquire}
            >
              {busy ? "Sending…" : "Send inquiry"}
            </Button>
          </>
        )}
      </div>
      {feedback ? (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {feedback}
        </p>
      ) : null}
      {reportOpen ? (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setReportOpen(false);
              restoreReportFocus();
            }
          }}
        >
          <form
            aria-labelledby="housing-report-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-6"
            onSubmit={submitReport}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  className="font-display text-xl font-black"
                  id="housing-report-title"
                >
                  Report a safety concern
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Reports are private. Do not include identity documents, access
                  codes or other sensitive information.
                </p>
              </div>
              <Button
                aria-label="Close report"
                onClick={() => {
                  setReportOpen(false);
                  restoreReportFocus();
                }}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X aria-hidden className="h-5 w-5" />
              </Button>
            </div>
            <label className="mt-5 grid gap-2 text-sm font-bold">
              Reason
              <select
                className="h-11 rounded-2xl border border-border bg-background px-3"
                onChange={(event) => setReportReason(event.target.value)}
                value={reportReason}
              >
                <option value="SCAM">Scam or suspicious payment</option>
                <option value="INAPPROPRIATE">
                  Misleading or inappropriate
                </option>
                <option value="HARASSMENT">
                  Harassment or unsafe behavior
                </option>
                <option value="SPAM">Spam or duplicate</option>
                <option value="OTHER">Other concern</option>
              </select>
            </label>
            <label className="mt-4 grid gap-2 text-sm font-bold">
              What happened? (optional)
              <textarea
                className="min-h-28 rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
                maxLength={1000}
                onChange={(event) => setReportDetails(event.target.value)}
                ref={reportFieldRef}
                value={reportDetails}
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                onClick={() => {
                  setReportOpen(false);
                  restoreReportFocus();
                }}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button disabled={busy} type="submit" variant="danger">
                {busy ? "Submitting…" : "Submit report"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
