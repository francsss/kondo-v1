"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Copy,
  ExternalLink,
  Flag,
  Mail,
  Phone,
  Send,
  Share2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrganizationPublicProfileDTO } from "@/lib/organization-public-profile";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

type Contact = OrganizationPublicProfileDTO["publicContactChannels"][number];

export function OrganizationPublicActions({
  organization,
}: {
  organization: OrganizationPublicProfileDTO;
}) {
  const [panel, setPanel] = useState<"contact" | "report" | null>(null);
  const [copied, setCopied] = useState("");
  const reducedMotion = useReducedMotion();
  const dialogRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closePanel = useCallback(() => {
    setPanel(null);
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!panel) return;
    window.requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>("button, a, input, select, textarea")
        ?.focus();
    });
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [closePanel, panel]);

  function openContact() {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setPanel("contact");
    captureProductEvent(PRODUCT_EVENTS.ORGANIZATION_CONTACT_OPENED, {
      organization_type: organization.organizationType,
      verification_state: organization.trust.verification.state,
      partner: organization.trust.partner.active,
    });
  }

  function openReport() {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setPanel("report");
    captureProductEvent(PRODUCT_EVENTS.ORGANIZATION_REPORT_STARTED, {
      organization_type: organization.organizationType,
    });
  }

  async function share() {
    const url = new URL(
      `/organizations/${organization.slug}`,
      window.location.origin,
    ).href;
    if (navigator.share) {
      await navigator
        .share({ title: organization.publicName, url })
        .catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(url);
      setCopied("share");
      window.setTimeout(() => setCopied(""), 1800);
    }
    captureProductEvent(PRODUCT_EVENTS.ORGANIZATION_SHARED, {
      organization_type: organization.organizationType,
    });
  }

  async function copy(contact: Contact) {
    await navigator.clipboard.writeText(contact.value);
    setCopied(contact.id);
    window.setTimeout(() => setCopied(""), 1800);
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {organization.publicContactChannels.length ? (
          <button
            className="inline-flex h-11 items-center gap-2 rounded-full bg-kondo-lime px-5 text-sm font-black text-kondo-forest transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={openContact}
            type="button"
          >
            <Mail className="h-4 w-4" />
            Contact
          </button>
        ) : null}
        <button
          className="inline-flex h-11 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          onClick={share}
          type="button"
        >
          {copied === "share" ? (
            <Check className="h-4 w-4" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
          {copied === "share" ? "Copied" : "Share"}
        </button>
        <button
          aria-label={`Report ${organization.publicName}`}
          className="inline-flex h-11 items-center gap-2 rounded-full px-3 text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          onClick={openReport}
          type="button"
        >
          <Flag className="h-4 w-4" />
          Report
        </button>
      </div>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>

      <AnimatePresence>
        {panel ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-overlay/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={closePanel}
            role="presentation"
            transition={{ duration: reducedMotion ? 0 : 0.16 }}
          >
            <motion.section
              aria-labelledby="organization-action-title"
              aria-modal="true"
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="max-h-[90dvh] w-full overflow-y-auto rounded-t-[2rem] border border-border bg-card p-5 text-card-foreground shadow-2xl sm:max-w-lg sm:rounded-[2rem] sm:p-6"
              exit={{ opacity: 0, y: reducedMotion ? 0 : 18, scale: 0.99 }}
              initial={{ opacity: 0, y: reducedMotion ? 0 : 24, scale: 0.99 }}
              onClick={(event) => event.stopPropagation()}
              ref={dialogRef}
              role="dialog"
              transition={{ duration: reducedMotion ? 0 : 0.2 }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-kondo-green">
                    {organization.publicName}
                  </p>
                  <h2
                    className="mt-1 text-2xl font-black tracking-tight"
                    id="organization-action-title"
                  >
                    {panel === "contact"
                      ? "Public contact channels"
                      : "Report a concern"}
                  </h2>
                </div>
                <button
                  aria-label="Close"
                  className="grid h-10 w-10 place-items-center rounded-full bg-muted transition hover:bg-secondary"
                  onClick={closePanel}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {panel === "contact" ? (
                <div className="mt-6 grid gap-3">
                  <p className="text-sm leading-6 text-muted-foreground">
                    These channels were made public by the organization. Kondo
                    will clearly indicate when a link takes you outside the
                    platform.
                  </p>
                  {organization.publicContactChannels.map((contact) => (
                    <div
                      className="flex items-center gap-3 rounded-2xl border border-border p-4"
                      key={contact.id}
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
                        {contact.type === "PHONE" ? (
                          <Phone className="h-4 w-4" />
                        ) : contact.type === "EMAIL" ? (
                          <Mail className="h-4 w-4" />
                        ) : (
                          <ExternalLink className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-muted-foreground">
                          {contact.label}
                        </p>
                        <p className="truncate text-sm font-black">
                          {contact.value}
                        </p>
                      </div>
                      <button
                        aria-label={`Copy ${contact.label}`}
                        className="grid h-10 w-10 place-items-center rounded-full border border-border transition hover:border-kondo-green hover:text-kondo-green"
                        onClick={() => copy(contact)}
                        type="button"
                      >
                        {copied === contact.id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      {contact.href ? (
                        <a
                          aria-label={`Open ${contact.label}`}
                          className="grid h-10 w-10 place-items-center rounded-full bg-kondo-forest text-white transition hover:bg-kondo-green"
                          href={contact.href}
                          onClick={() => {
                            if (contact.type === "WEBSITE") {
                              captureProductEvent(
                                PRODUCT_EVENTS.ORGANIZATION_WEBSITE_OPENED,
                                {
                                  organization_type:
                                    organization.organizationType,
                                },
                              );
                            }
                          }}
                          rel={
                            contact.external ? "noopener noreferrer" : undefined
                          }
                          target={contact.external ? "_blank" : undefined}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <OrganizationReportForm
                  organizationId={organization.id}
                  onDone={closePanel}
                />
              )}
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function OrganizationReportForm({
  organizationId,
  onDone,
}: {
  organizationId: string;
  onDone: () => void;
}) {
  const [category, setCategory] = useState("MISLEADING_IDENTITY");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/report`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, details }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(
          response.status === 401
            ? "Log in to Kondo before submitting a safety report."
            : data.error || "The report could not be submitted.",
        );
        return;
      }
      setSuccess(true);
      setMessage("Thank you. Kondo’s moderation team received your report.");
    } catch {
      setMessage("Kondo could not reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="mt-6 rounded-3xl bg-kondo-mint p-5 text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
        <Check className="h-6 w-6" />
        <p className="mt-3 font-black">{message}</p>
        <button
          className="mt-4 rounded-full bg-kondo-forest px-4 py-2 text-sm font-black text-white"
          onClick={onDone}
          type="button"
        >
          Done
        </button>
      </div>
    );
  }
  return (
    <form className="mt-6 grid gap-4" onSubmit={submit}>
      <p className="text-sm leading-6 text-muted-foreground">
        Reports are private. One report does not automatically suspend an
        organization.
      </p>
      <label>
        <span className="mb-2 block text-sm font-bold">Concern</span>
        <select
          className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm"
          onChange={(event) => setCategory(event.target.value)}
          value={category}
        >
          <option value="MISLEADING_IDENTITY">Misleading identity</option>
          <option value="IMPERSONATION">Impersonation</option>
          <option value="SCAM_OR_FRAUD">Scam or fraud concern</option>
          <option value="UNSAFE_HOUSING_CLAIM">Unsafe housing claim</option>
          <option value="FALSE_SCHOLARSHIP_CLAIM">
            False scholarship claim
          </option>
          <option value="SUSPICIOUS_JOB">Suspicious job or internship</option>
          <option value="PROHIBITED_SERVICE">Prohibited service</option>
          <option value="INAPPROPRIATE_CONTENT">Inappropriate content</option>
          <option value="OUTDATED_INFORMATION">
            Outdated or incorrect information
          </option>
          <option value="OTHER">Other</option>
        </select>
      </label>
      <label>
        <span className="mb-2 block text-sm font-bold">What happened?</span>
        <textarea
          className="min-h-32 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-kondo-green focus:ring-4 focus:ring-kondo-green/10"
          maxLength={1000}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Share the specific information Kondo should review."
          required
          value={details}
        />
      </label>
      {message ? (
        <p className="text-sm font-semibold text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      <button
        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-kondo-forest px-5 text-sm font-black text-white transition hover:bg-kondo-green disabled:opacity-60"
        disabled={submitting || details.trim().length < 10}
        type="submit"
      >
        <Send className="h-4 w-4" />
        {submitting ? "Submitting…" : "Submit report"}
      </button>
    </form>
  );
}
