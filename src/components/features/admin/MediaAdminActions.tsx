"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function MediaAdminActions({
  mediaId,
  removed,
}: {
  mediaId: string;
  removed: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const reason = String(values.get("reason") ?? "");
    if (
      !window.confirm(
        "Remove this file from delivery? Its metadata and audit history will be preserved.",
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/media/${mediaId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Media could not be removed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Media could not be removed.");
    } finally {
      setSaving(false);
    }
  }

  if (removed) {
    return (
      <p className="text-sm font-semibold text-slate-400">
        This media has already been removed from delivery.
      </p>
    );
  }

  return (
    <form className="space-y-3" onSubmit={remove}>
      <label className="block">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-300">
          Removal reason
        </span>
        <textarea
          className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-transparent px-4 py-3 text-sm outline-none focus:border-red-400 dark:border-white/10"
          maxLength={500}
          minLength={10}
          name="reason"
          placeholder="Explain the policy or safety reason for removal."
          required
        />
      </label>
      {error ? (
        <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <Button disabled={saving} type="submit" variant="danger">
        <Trash2 className="h-4 w-4" />
        {saving ? "Removing…" : "Remove media"}
      </Button>
    </form>
  );
}
