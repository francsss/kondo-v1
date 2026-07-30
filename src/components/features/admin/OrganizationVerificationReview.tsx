"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

const options = [
  ["UNDER_REVIEW", "Mark under review"],
  ["MORE_INFORMATION_REQUIRED", "Request more information"],
  ["APPROVED", "Approve verification"],
  ["REJECTED", "Reject request"],
  ["SUSPENDED", "Suspend verification"],
  ["REVOKED", "Revoke verification"],
] as const;

export function OrganizationVerificationReview({
  requestId,
  currentStatus,
}: {
  requestId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = String(form.get("status") ?? "");
    if (!window.confirm(`Move this request to ${status.toLowerCase()}?`))
      return;
    setPending(true);
    setFeedback("");
    setIsError(false);
    try {
      const response = await fetch(
        `/api/admin/organization-verifications/${requestId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            userVisibleResponse: form.get("userVisibleResponse"),
            reviewerNote: form.get("reviewerNote"),
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback(data.error ?? "The review decision could not be saved.");
        setIsError(true);
        return;
      }
      setFeedback("Review decision saved and organization owners notified.");
      router.refresh();
    } catch {
      setFeedback("Kondo could not reach the server.");
      setIsError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <p className="text-xs text-muted-foreground">
        Current request status: {currentStatus}
      </p>
      <label className="block text-sm font-bold">
        Decision
        <select
          className="mt-2 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
          name="status"
        >
          {options.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-bold">
        Message visible to the organization
        <textarea
          className="mt-2 min-h-28 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          maxLength={1200}
          minLength={4}
          name="userVisibleResponse"
          required
        />
      </label>
      <label className="block text-sm font-bold">
        Internal reviewer note
        <textarea
          className="mt-2 min-h-24 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          maxLength={2000}
          name="reviewerNote"
        />
      </label>
      <Button disabled={pending} type="submit">
        {pending ? "Saving review…" : "Save reviewed decision"}
      </Button>
      {feedback ? (
        <p
          className={
            isError
              ? "text-sm font-semibold text-destructive"
              : "text-sm font-semibold text-kondo-green"
          }
          role={isError ? "alert" : "status"}
        >
          {feedback}
        </p>
      ) : null}
    </form>
  );
}
