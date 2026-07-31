"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, LoaderCircle } from "lucide-react";

const STATUS_OPTIONS = [
  ["UNDER_REVIEW", "Move to review"],
  ["MORE_INFORMATION_REQUIRED", "Request more information"],
  ["SHORTLISTED", "Shortlist"],
  ["OFFERED", "Record offer"],
  ["REJECTED", "Not selected"],
  ["CANCELLED", "Cancel application"],
] as const;

function readError(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string") return error;
  }
  return "The action could not be completed.";
}

export function OpportunityReviewerActions({
  organizationId,
  applicationId,
}: {
  organizationId: string;
  applicationId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState("UNDER_REVIEW");
  const [applicantNote, setApplicantNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [format, setFormat] = useState("VIDEO");
  const [scheduledAt, setScheduledAt] = useState("");
  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [preparationNote, setPreparationNote] = useState("");

  async function post(url: string, body: object) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as unknown;
    setMessage(response.ok ? "Saved" : readError(payload));
    if (response.ok) router.refresh();
    setBusy(false);
  }

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-2">
      <section className="rounded-3xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-white/[0.04]">
        <h2 className="text-lg font-black">Review decision</h2>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="mt-4 w-full rounded-2xl border border-black/10 bg-background px-4 py-3 text-sm dark:border-white/10"
        >
          {STATUS_OPTIONS.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <label className="mt-4 block text-sm font-bold">
          Note shared with applicant
          <textarea
            rows={3}
            value={applicantNote}
            onChange={(event) => setApplicantNote(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal dark:border-white/10"
          />
        </label>
        <label className="mt-4 block text-sm font-bold">
          Internal note{" "}
          <span className="font-normal text-muted-foreground">
            (never shared)
          </span>
          <textarea
            rows={3}
            value={internalNote}
            onChange={(event) => setInternalNote(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-3 font-normal dark:border-amber-400/20 dark:bg-amber-400/5"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void post(
              `/api/organizations/${organizationId}/opportunity-applications/${applicationId}/status`,
              {
                toStatus: status,
                applicantVisibleNote: applicantNote || null,
                internalNote: internalNote || null,
              },
            )
          }
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-kondo-green px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          Save decision
        </button>
      </section>

      <section className="rounded-3xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-white/[0.04]">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <CalendarPlus className="h-5 w-5 text-kondo-green" /> Schedule
          interview
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold">
            Format
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-background px-4 py-3 font-normal dark:border-white/10"
            >
              <option value="VIDEO">Video</option>
              <option value="PHONE">Phone</option>
              <option value="IN_PERSON">In person</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            Date and time
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal dark:border-white/10"
            />
          </label>
        </div>
        <label className="mt-3 block text-sm font-bold">
          Timezone
          <input
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal dark:border-white/10"
          />
        </label>
        {format === "VIDEO" ? (
          <label className="mt-3 block text-sm font-bold">
            Secure meeting URL
            <input
              type="url"
              value={meetingUrl}
              onChange={(event) => setMeetingUrl(event.target.value)}
              placeholder="https://"
              className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal dark:border-white/10"
            />
          </label>
        ) : null}
        {format === "IN_PERSON" ? (
          <label className="mt-3 block text-sm font-bold">
            Location
            <input
              value={locationLabel}
              onChange={(event) => setLocationLabel(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal dark:border-white/10"
            />
          </label>
        ) : null}
        <label className="mt-3 block text-sm font-bold">
          Preparation note
          <textarea
            rows={2}
            value={preparationNote}
            onChange={(event) => setPreparationNote(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal dark:border-white/10"
          />
        </label>
        <button
          type="button"
          disabled={busy || !scheduledAt}
          onClick={() =>
            void post(
              `/api/organizations/${organizationId}/opportunity-applications/${applicationId}/interview`,
              {
                format,
                scheduledAt,
                timezone,
                meetingUrl: meetingUrl || null,
                locationLabel: locationLabel || null,
                preparationNote: preparationNote || null,
              },
            )
          }
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-kondo-green px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <CalendarPlus className="h-4 w-4" />
          )}
          Send invitation
        </button>
      </section>
      {message ? (
        <p role="status" className="text-sm font-semibold lg:col-span-2">
          {message}
        </p>
      ) : null}
    </div>
  );
}
