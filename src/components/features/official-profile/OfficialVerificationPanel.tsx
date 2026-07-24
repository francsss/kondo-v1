"use client";

import {
  FileCheck2,
  LoaderCircle,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { useRef, useState } from "react";
import { OfficialMark } from "@/components/features/official-profile/OfficialMark";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { uploadMediaFile } from "@/lib/client-media";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

type VerificationState = {
  user: {
    officialProfileStatus: string;
    officialOrganizationType: string | null;
    officialOrganizationName: string | null;
    officialVerifiedAt: Date | null;
    officialReviewDueAt: Date | null;
  };
  requests: Array<{
    id: string;
    status: string;
    organizationType: string;
    organizationName: string;
    decisionReason: string | null;
    submittedAt: Date | null;
    updatedAt: Date;
    version: number;
    documents: Array<{
      id: string;
      label: string;
      mediaId: string;
      createdAt: Date;
    }>;
  }>;
};

const organizationTypes = [
  ["UNIVERSITY", "University"],
  ["STUDENT_ASSOCIATION", "Recognized student association"],
  ["COMMUNITY", "Official community"],
  ["COMPANY", "Company"],
  ["EVENT_ORGANIZER", "Event organizer"],
  ["INSTITUTION", "Institution"],
  ["OTHER", "Other organization"],
] as const;

export function OfficialVerificationPanel({
  state,
}: {
  state: VerificationState;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const latest = state.requests[0];
  const canSubmit =
    !latest ||
    ["STARTED", "MORE_INFO_REQUIRED", "REVIEW_REQUIRED", "REJECTED"].includes(
      latest.status,
    );
  const [organizationType, setOrganizationType] = useState(
    latest?.organizationType ?? "UNIVERSITY",
  );
  const [organizationName, setOrganizationName] = useState(
    latest?.organizationName ?? "",
  );
  const [authorityDescription, setAuthorityDescription] = useState("");
  const [officialWebsite, setOfficialWebsite] = useState("");
  const [documents, setDocuments] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function addDocuments(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files).slice(0, 5);
    if (
      selected.some(
        (file) =>
          file.type !== "application/pdf" ||
          !file.name.toLowerCase().endsWith(".pdf") ||
          file.size > 10 * 1024 * 1024,
      )
    ) {
      setError("Use PDF documents of 10 MB or less.");
      return;
    }
    setDocuments(selected);
    setError("");
    captureProductEvent(PRODUCT_EVENTS.VERIFICATION_REQUEST_STARTED, {
      organization_type: organizationType,
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!documents.length) {
      setError("Add at least one confidential verification document.");
      return;
    }
    setPending(true);
    setProgress(0);
    setError("");
    setSuccess("");
    try {
      const uploaded: Array<{ mediaId: string; label: string }> = [];
      for (let index = 0; index < documents.length; index += 1) {
        const document = documents[index];
        const mediaId = await uploadMediaFile(document, {
          purpose: "VERIFICATION_DOCUMENT",
          onProgress: (value) =>
            setProgress(
              Math.round(((index + value / 100) / documents.length) * 95),
            ),
        });
        uploaded.push({ mediaId, label: document.name.replace(/\.pdf$/i, "") });
      }
      const response = await fetch("/api/official-profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationType,
          organizationName,
          authorityDescription,
          officialWebsite: officialWebsite || null,
          documents: uploaded,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Verification request could not be submitted.",
        );
      }
      setProgress(100);
      setSuccess("Your confidential request is now with Kondo's trust team.");
      setDocuments([]);
      captureProductEvent(PRODUCT_EVENTS.VERIFICATION_REQUEST_SUBMITTED, {
        request_id: payload?.id,
        organization_type: organizationType,
        document_count: uploaded.length,
      });
      window.location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Verification request could not be submitted.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="p-6 sm:p-8">
        {state.user.officialProfileStatus === "APPROVED" ? (
          <div className="mb-7 rounded-3xl border border-emerald-200 bg-kondo-mint/50 p-5 dark:border-emerald-400/15 dark:bg-emerald-400/5">
            <OfficialMark
              organizationName={state.user.officialOrganizationName}
              organizationType={state.user.officialOrganizationType}
              size="md"
              verifiedAt={state.user.officialVerifiedAt}
              withLabel
            />
            <h2 className="mt-4 text-xl font-black text-kondo-ink dark:text-white">
              Your organization is recognized by Kondo
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The Official Mark remains visible while the verification is
              active. Kondo may request a periodic review to keep it current.
            </p>
          </div>
        ) : null}

        <h2 className="text-xl font-black text-kondo-ink dark:text-white">
          {latest?.status === "MORE_INFO_REQUIRED"
            ? "Provide the requested information"
            : "Request official recognition"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This process is for people authorized to represent a real
          organization. Trusted Creator status is separate and does not create
          an Official Mark.
        </p>

        {latest?.decisionReason ? (
          <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
            <strong>Kondo review note:</strong> {latest.decisionReason}
          </p>
        ) : null}

        {canSubmit ? (
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Organization type">
                <select
                  className="h-11 w-full rounded-2xl border border-border bg-card px-4 text-sm"
                  onChange={(event) => setOrganizationType(event.target.value)}
                  value={organizationType}
                >
                  {organizationTypes.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Official organization name">
                <input
                  className="h-11 w-full rounded-2xl border border-border bg-transparent px-4 text-sm"
                  maxLength={160}
                  minLength={2}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  required
                  value={organizationName}
                />
              </Field>
            </div>
            <Field label="Why are you authorized to represent it?">
              <textarea
                className="min-h-28 w-full rounded-2xl border border-border bg-transparent p-4 text-sm leading-6"
                maxLength={1000}
                minLength={20}
                onChange={(event) =>
                  setAuthorityDescription(event.target.value)
                }
                required
                value={authorityDescription}
              />
            </Field>
            <Field label="Official website · optional">
              <input
                className="h-11 w-full rounded-2xl border border-border bg-transparent px-4 text-sm"
                onChange={(event) => setOfficialWebsite(event.target.value)}
                placeholder="https://"
                type="url"
                value={officialWebsite}
              />
            </Field>
            <button
              className="flex min-h-28 w-full items-center gap-4 rounded-3xl border border-dashed border-kondo-green/35 bg-kondo-mint/35 p-5 text-left transition hover:bg-kondo-mint/60 dark:bg-emerald-400/5"
              disabled={pending}
              onClick={() => fileRef.current?.click()}
              type="button"
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-kondo-green shadow-sm dark:bg-white/10">
                <UploadCloud className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-black">
                  {documents.length
                    ? `${documents.length} confidential document${
                        documents.length === 1 ? "" : "s"
                      } selected`
                    : "Add confidential PDF evidence"}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Authorization letters, official registration or equivalent ·
                  maximum 5
                </span>
              </span>
            </button>
            <input
              accept="application/pdf,.pdf"
              className="sr-only"
              multiple
              onChange={(event) => addDocuments(event.target.files)}
              ref={fileRef}
              type="file"
            />
            {pending ? (
              <div className="rounded-2xl bg-muted/50 p-4">
                <div className="flex justify-between text-xs font-black">
                  <span>Secure upload</span>
                  <span>{progress}%</span>
                </div>
                <div
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={progress}
                  className="mt-2 h-2 overflow-hidden rounded-full bg-card"
                  role="progressbar"
                >
                  <div
                    className="h-full bg-kondo-green transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : null}
            {error ? (
              <p className="text-xs font-semibold text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="text-xs font-semibold text-kondo-green">
                {success}
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button disabled={pending} type="submit">
                {pending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Submit confidential request
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-6 rounded-3xl bg-muted/50 p-5">
            <p className="text-xs font-black uppercase tracking-wider text-kondo-green">
              {latest?.status.replaceAll("_", " ")}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your request is being reviewed. Kondo will notify you when a
              decision or additional-information request is available.
            </p>
          </div>
        )}
      </Card>

      <aside className="space-y-5">
        <Card>
          <FileCheck2 className="h-5 w-5 text-kondo-green" />
          <h2 className="mt-4 font-black text-kondo-ink dark:text-white">
            Privacy by design
          </h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Documents remain private and are accessible only to you and
            authorized Kondo reviewers. They never appear on your public profile
            or in analytics.
          </p>
        </Card>
        <Card>
          <h2 className="font-black text-kondo-ink dark:text-white">
            Request history
          </h2>
          <div className="mt-4 space-y-3">
            {state.requests.map((request) => (
              <div
                className="rounded-2xl border border-border p-3"
                key={request.id}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-black">
                    {request.organizationName}
                  </p>
                  <span className="rounded-full bg-muted px-2 py-1 text-[8px] font-black uppercase tracking-wider">
                    {request.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Version {request.version} · {request.documents.length} private
                  document{request.documents.length === 1 ? "" : "s"}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black text-kondo-ink dark:text-white">
        {label}
      </span>
      {children}
    </label>
  );
}
