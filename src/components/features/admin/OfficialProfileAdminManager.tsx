"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  LoaderCircle,
  PauseCircle,
  SearchCheck,
  ShieldX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

type RequestRecord = {
  id: string;
  status: string;
  organizationType: string;
  organizationName: string;
  authorityDescription: string;
  officialWebsite: string | null;
  decisionReason: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  nextReviewAt: Date | null;
  version: number;
  updatedAt: Date;
  applicant: {
    id: string;
    firstName: string;
    lastName: string;
    username: string | null;
    email: string;
    officialProfileStatus: string;
  };
  reviewer: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  documents: Array<{
    id: string;
    label: string;
    mediaId: string;
    createdAt: Date;
  }>;
};

export function OfficialProfileAdminManager({
  requests,
}: {
  requests: RequestRecord[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  async function decide(requestId: string, status: string) {
    const reason = window.prompt(
      status === "APPROVED"
        ? "Record why this organization and authority were verified:"
        : "Give a clear decision reason for the applicant and audit history:",
    );
    if (!reason) return;
    let nextReviewAt: string | null = null;
    if (status === "APPROVED") {
      const review = new Date();
      review.setUTCFullYear(review.getUTCFullYear() + 1);
      nextReviewAt = review.toISOString();
    }
    setPending(requestId);
    setError("");
    const response = await fetch(`/api/admin/official-profiles/${requestId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reason, nextReviewAt }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setPending("");
    if (!response?.ok) {
      setError(payload?.error ?? "The verification decision failed.");
      return;
    }
    const event =
      status === "APPROVED"
        ? PRODUCT_EVENTS.VERIFICATION_REQUEST_APPROVED
        : status === "REJECTED"
          ? PRODUCT_EVENTS.VERIFICATION_REQUEST_REJECTED
          : status === "MORE_INFO_REQUIRED"
            ? PRODUCT_EVENTS.VERIFICATION_REQUEST_MORE_INFO_REQUESTED
            : status === "SUSPENDED"
              ? PRODUCT_EVENTS.OFFICIAL_STATUS_SUSPENDED
              : status === "REVOKED"
                ? PRODUCT_EVENTS.OFFICIAL_STATUS_REVOKED
                : null;
    if (event) {
      captureProductEvent(event, {
        verification_request_id: requestId,
      });
    }
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-4">
      {error ? (
        <p className="rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {requests.map((request) => (
        <Card
          className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_280px]"
          key={request.id}
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-muted px-2.5 py-1 text-[9px] font-black uppercase tracking-wider">
                {request.status.replaceAll("_", " ")}
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-kondo-green">
                {request.organizationType.replaceAll("_", " ")}
              </span>
              <span className="text-[10px] text-muted-foreground">
                version {request.version}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-black text-kondo-ink dark:text-white">
              {request.organizationName}
            </h2>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              Requested by {request.applicant.firstName}{" "}
              {request.applicant.lastName} · {request.applicant.email}
            </p>
            <div className="mt-4 rounded-2xl bg-muted/50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Claimed authority
              </p>
              <p className="mt-2 whitespace-pre-line text-sm leading-6">
                {request.authorityDescription}
              </p>
              {request.officialWebsite ? (
                <a
                  className="mt-3 inline-flex text-xs font-black text-kondo-green hover:underline"
                  href={request.officialWebsite}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open official website ↗
                </a>
              ) : null}
            </div>
            <div className="mt-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Confidential evidence
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {request.documents.map((document) => (
                  <a
                    className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border px-3 text-xs font-bold transition hover:border-kondo-green"
                    href={`/api/media/${document.mediaId}`}
                    key={document.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <FileText className="h-4 w-4 text-kondo-green" />
                    {document.label}
                  </a>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Private files. Do not download or share outside the authorized
                Kondo review process.
              </p>
            </div>
            {request.decisionReason ? (
              <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
                <strong>Last decision:</strong> {request.decisionReason}
              </p>
            ) : null}
          </div>

          <aside className="space-y-2 rounded-3xl border border-border p-4">
            <p className="mb-3 text-xs font-black">Trust decision</p>
            {["SUBMITTED", "MORE_INFO_REQUIRED"].includes(request.status) ? (
              <Decision
                icon={SearchCheck}
                label="Start review"
                onClick={() => decide(request.id, "UNDER_REVIEW")}
                pending={pending === request.id}
              />
            ) : null}
            {["SUBMITTED", "UNDER_REVIEW"].includes(request.status) ? (
              <>
                <Decision
                  icon={CheckCircle2}
                  label="Approve Official Profile"
                  onClick={() => decide(request.id, "APPROVED")}
                  pending={pending === request.id}
                />
                <Decision
                  icon={AlertTriangle}
                  label="Request more information"
                  onClick={() => decide(request.id, "MORE_INFO_REQUIRED")}
                  pending={pending === request.id}
                />
                <Decision
                  danger
                  icon={ShieldX}
                  label="Reject request"
                  onClick={() => decide(request.id, "REJECTED")}
                  pending={pending === request.id}
                />
              </>
            ) : null}
            {request.status === "APPROVED" ? (
              <>
                <Decision
                  icon={PauseCircle}
                  label="Suspend Official Profile"
                  onClick={() => decide(request.id, "SUSPENDED")}
                  pending={pending === request.id}
                />
                <Decision
                  danger
                  icon={ShieldX}
                  label="Revoke status"
                  onClick={() => decide(request.id, "REVOKED")}
                  pending={pending === request.id}
                />
              </>
            ) : null}
            {request.status === "SUSPENDED" ? (
              <>
                <Decision
                  icon={CheckCircle2}
                  label="Restore approval"
                  onClick={() => decide(request.id, "APPROVED")}
                  pending={pending === request.id}
                />
                <Decision
                  danger
                  icon={ShieldX}
                  label="Revoke status"
                  onClick={() => decide(request.id, "REVOKED")}
                  pending={pending === request.id}
                />
              </>
            ) : null}
            <p className="pt-3 text-[10px] leading-4 text-muted-foreground">
              All decisions require a reason and are written to the global audit
              log with the reviewer identity.
            </p>
          </aside>
        </Card>
      ))}
      {!requests.length ? (
        <Card className="py-16 text-center text-sm text-muted-foreground">
          No official-profile requests match this view.
        </Card>
      ) : null}
    </div>
  );
}

function Decision({
  icon: Icon,
  label,
  onClick,
  pending,
  danger = false,
}: {
  icon: typeof CheckCircle2;
  label: string;
  onClick: () => void;
  pending: boolean;
  danger?: boolean;
}) {
  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={onClick}
      size="sm"
      type="button"
      variant={danger ? "danger" : "secondary"}
    >
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
