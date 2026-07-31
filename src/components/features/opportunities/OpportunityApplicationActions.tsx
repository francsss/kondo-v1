"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, LoaderCircle, MapPin, Video } from "lucide-react";

type Interview = {
  id: string;
  format: string;
  scheduledAt: string;
  timezone: string;
  locationLabel: string | null;
  meetingUrl: string | null;
  preparationNote: string | null;
  status: string;
};

function readError(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string") return error;
  }
  return "The action could not be completed.";
}

export function OpportunityApplicationActions({
  applicationId,
  status,
  opportunityHref,
  interviews,
}: {
  applicationId: string;
  status: string;
  opportunityHref: string | null;
  interviews: Interview[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function action(url: string, body?: object) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const payload = (await response.json()) as unknown;
    if (response.ok) router.refresh();
    else setMessage(readError(payload));
    setBusy(false);
  }

  const withdrawable = [
    "SUBMITTED",
    "UNDER_REVIEW",
    "MORE_INFORMATION_REQUIRED",
    "SHORTLISTED",
    "INTERVIEW",
  ].includes(status);

  return (
    <>
      {interviews.length ? (
        <section className="mt-8" aria-labelledby="interviews-heading">
          <h2 id="interviews-heading" className="text-lg font-black">
            Interviews
          </h2>
          <ul className="mt-3 space-y-3">
            {interviews.map((interview) => (
              <li
                key={interview.id}
                className="rounded-3xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-white/[0.04]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black">
                    {interview.format.replace(/_/g, " ")}
                  </p>
                  <span className="rounded-full bg-kondo-green/10 px-3 py-1 text-xs font-bold text-kondo-green">
                    {interview.status.toLowerCase().replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-3 flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-kondo-green" />
                  {new Date(interview.scheduledAt).toLocaleString("en-GB", {
                    timeZone: interview.timezone,
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  ({interview.timezone})
                </p>
                {interview.locationLabel ? (
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" /> {interview.locationLabel}
                  </p>
                ) : null}
                {interview.preparationNote ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {interview.preparationNote}
                  </p>
                ) : null}
                {interview.status === "PROPOSED" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void action(
                          `/api/opportunities/applications/${applicationId}/interviews/${interview.id}/respond`,
                          { response: "ACCEPTED" },
                        )
                      }
                      disabled={busy}
                      className="rounded-full bg-kondo-green px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      Accept time
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void action(
                          `/api/opportunities/applications/${applicationId}/interviews/${interview.id}/respond`,
                          { response: "DECLINED" },
                        )
                      }
                      disabled={busy}
                      className="rounded-full border border-black/10 px-4 py-2 text-sm font-bold disabled:opacity-50 dark:border-white/10"
                    >
                      Decline
                    </button>
                  </div>
                ) : interview.status === "ACCEPTED" && interview.meetingUrl ? (
                  <a
                    href={interview.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-kondo-green px-4 py-2 text-sm font-bold text-white"
                  >
                    <Video className="h-4 w-4" /> Join meeting
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8 rounded-3xl border border-black/5 p-5 dark:border-white/10">
        <h2 className="text-lg font-black">Available actions</h2>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {status === "MORE_INFORMATION_REQUIRED" && opportunityHref ? (
            <a
              href={`${opportunityHref}/apply`}
              className="rounded-full bg-kondo-green px-4 py-2 text-sm font-bold text-white"
            >
              Update information
            </a>
          ) : null}
          {status === "OFFERED" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void action(
                    `/api/opportunities/applications/${applicationId}/offer`,
                    { decision: "ACCEPT" },
                  )
                }
                className="rounded-full bg-kondo-green px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Accept offer
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void action(
                    `/api/opportunities/applications/${applicationId}/offer`,
                    { decision: "DECLINE" },
                  )
                }
                className="rounded-full border border-black/10 px-4 py-2 text-sm font-bold disabled:opacity-50 dark:border-white/10"
              >
                Decline offer
              </button>
            </>
          ) : null}
          {withdrawable ? (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void action(
                  `/api/opportunities/applications/${applicationId}/withdraw`,
                )
              }
              className="rounded-full border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 disabled:opacity-50 dark:border-rose-400/20 dark:text-rose-300"
            >
              Withdraw application
            </button>
          ) : null}
          {!withdrawable &&
          status !== "OFFERED" &&
          status !== "MORE_INFORMATION_REQUIRED" ? (
            <p className="text-sm text-muted-foreground">
              No action is required right now.
            </p>
          ) : null}
          {busy ? (
            <LoaderCircle className="h-5 w-5 animate-spin text-kondo-green" />
          ) : null}
        </div>
        {message ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-rose-600">
            {message}
          </p>
        ) : null}
      </section>
    </>
  );
}
