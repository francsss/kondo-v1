"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const statuses = ["ACTIVE", "SUSPENDED", "DEACTIVATED"];

export function UserStatusActions({
  userId,
  initialStatus,
}: {
  userId: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function saveStatus() {
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/admin/users/${userId}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reason }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setPending(false);
    if (response?.ok) {
      setMessage(
        payload.sessionsRevoked
          ? `Status updated. ${payload.sessionsRevoked} session(s) revoked.`
          : "Status updated.",
      );
      setReason("");
      router.refresh();
    } else {
      setMessage(payload?.error ?? "Could not update status.");
    }
  }

  async function revokeSessions() {
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/admin/users/${userId}/sessions`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setPending(false);
    setMessage(
      response?.ok
        ? `${payload.sessionsRevoked} session(s) revoked.`
        : (payload?.error ?? "Could not revoke sessions."),
    );
    if (response?.ok) router.refresh();
  }

  return (
    <Card>
      <h2 className="font-black text-kondo-ink dark:text-white">
        Account control
      </h2>
      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-bold">Status</span>
        <select
          className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
          onChange={(event) => setStatus(event.target.value)}
          value={status}
        >
          {statuses.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <textarea
        className="mt-4 min-h-20 w-full rounded-2xl border border-slate-200 bg-transparent p-3 text-sm dark:border-white/10"
        maxLength={500}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason for this change (10+ characters, required)"
        value={reason}
      />
      <p className="mt-2 text-xs text-slate-400">
        Suspending or deactivating this account immediately revokes all of its
        active sessions.
      </p>
      {message ? (
        <p className="mt-3 text-xs text-slate-400" role="status">
          {message}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          disabled={pending || reason.trim().length < 10}
          onClick={saveStatus}
          type="button"
        >
          {pending ? "Saving…" : "Save status"}
        </Button>
        <Button
          disabled={pending}
          onClick={revokeSessions}
          type="button"
          variant="secondary"
        >
          Revoke all sessions
        </Button>
      </div>
    </Card>
  );
}
