"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type RequestStatus =
  "PENDING" | "PROCESSING" | "COMPLETED" | "REJECTED" | "CANCELLED";

export function AccountRequestActions({
  requestId,
  status,
  version,
}: {
  requestId: string;
  status: RequestStatus;
  version: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  if (status !== "PENDING" && status !== "PROCESSING") return null;

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/admin/account-requests/${requestId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: values.get("status"),
          responseNote: values.get("responseNote") || undefined,
          expectedVersion: version,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback(payload.error ?? "Request could not be updated.");
        return;
      }
      router.refresh();
    } catch {
      setFeedback("Request could not be updated.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-white/5"
      onSubmit={update}
    >
      <select
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5"
        name="status"
      >
        {status === "PENDING" ? (
          <option value="PROCESSING">Start processing</option>
        ) : (
          <option value="COMPLETED">Complete</option>
        )}
        <option value="REJECTED">Reject</option>
      </select>
      <textarea
        className="min-h-20 rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
        maxLength={2000}
        name="responseNote"
        placeholder="Required for completion or rejection."
      />
      {feedback ? (
        <p className="text-xs text-red-600 dark:text-red-300">{feedback}</p>
      ) : null}
      <Button disabled={pending} size="sm" type="submit">
        {pending ? "Updating…" : "Update request"}
      </Button>
    </form>
  );
}
