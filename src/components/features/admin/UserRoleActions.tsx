"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const roles = ["MEMBER", "MODERATOR", "ADMIN", "SUPER_ADMIN"] as const;

export function UserRoleActions({
  userId,
  initialRole,
}: {
  userId: string;
  initialRole: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState(initialRole);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function saveRole() {
    if (!window.confirm(`Change this account role to ${role}?`)) return;
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, reason }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setPending(false);
    if (!response?.ok) {
      setMessage(payload?.error ?? "Could not update the role.");
      return;
    }
    setMessage(
      payload.sessionsRevoked
        ? `Role updated. ${payload.sessionsRevoked} session(s) revoked.`
        : "Role updated.",
    );
    setReason("");
    router.refresh();
  }

  return (
    <Card>
      <h2 className="font-black text-kondo-ink dark:text-white">
        Administrator role
      </h2>
      <p className="mt-2 text-xs text-muted-foreground">
        Restricted to Super Admins. Role changes revoke active sessions and are
        recorded in the audit log.
      </p>
      <select
        className="mt-4 h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
        onChange={(event) => setRole(event.target.value)}
        value={role}
      >
        {roles.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <textarea
        className="mt-4 min-h-20 w-full rounded-2xl border border-slate-200 bg-transparent p-3 text-sm dark:border-white/10"
        maxLength={500}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason for this role change"
        value={reason}
      />
      {message ? (
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      <Button
        className="mt-4"
        disabled={pending || reason.trim().length < 5 || role === initialRole}
        onClick={saveRole}
        type="button"
      >
        {pending ? "Saving…" : "Save role"}
      </Button>
    </Card>
  );
}
