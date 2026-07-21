"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Ban,
  Flag,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

const reasons = ["SPAM", "HARASSMENT", "SCAM", "INAPPROPRIATE", "OTHER"];

export function ConversationActions({
  conversationId,
  otherUserId,
  initiallyBlocked,
  initiallyArchived,
}: {
  conversationId: string;
  otherUserId: string;
  initiallyBlocked: boolean;
  initiallyArchived: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const [archived, setArchived] = useState(initiallyArchived);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  async function toggleBlock() {
    setPending(true);
    setStatus("");
    const response = await fetch(`/api/users/${otherUserId}/block`, {
      method: blocked ? "DELETE" : "POST",
      credentials: "include",
    });
    const payload = await response.json().catch(() => null);
    if (response.ok) {
      setBlocked(!blocked);
      setStatus(blocked ? "User unblocked." : "User blocked.");
      router.refresh();
    } else {
      setStatus(payload?.error ?? "Could not update this setting.");
    }
    setPending(false);
  }

  async function toggleArchive() {
    setPending(true);
    setStatus("");
    const response = await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !archived }),
    });
    const payload = await response.json().catch(() => null);
    if (response.ok) {
      setArchived(!archived);
      setStatus(archived ? "Conversation restored." : "Conversation archived.");
      router.refresh();
    } else {
      setStatus(payload?.error ?? "Could not update this conversation.");
    }
    setPending(false);
  }

  async function clearConversation() {
    if (
      !window.confirm(
        "Hide this conversation and its current history from your account? The other participant and existing safety evidence are not affected.",
      )
    ) {
      return;
    }
    setPending(true);
    setStatus("");
    const response = await fetch(`/api/conversations/${conversationId}`, {
      method: "DELETE",
      credentials: "include",
    });
    const payload = await response.json().catch(() => null);
    if (response.ok) {
      router.replace("/messages");
      router.refresh();
      return;
    }
    setStatus(payload?.error ?? "Could not hide this conversation.");
    setPending(false);
  }

  async function submitReport(formData: FormData) {
    setPending(true);
    setStatus("");
    const response = await fetch(
      `/api/conversations/${conversationId}/report`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: formData.get("reason"),
          details: formData.get("details") || undefined,
        }),
      },
    );
    const payload = await response.json().catch(() => null);
    setStatus(
      response.ok
        ? "Report submitted for review."
        : (payload?.error ?? "Could not submit the report."),
    );
    if (response.ok) setReporting(false);
    setPending(false);
  }

  return (
    <div className="relative">
      <Button
        aria-expanded={open}
        aria-label="Conversation options"
        onClick={() => setOpen((current) => !current)}
        size="icon"
        variant="ghost"
      >
        <MoreHorizontal className="h-5 w-5" />
      </Button>
      {open ? (
        <div className="absolute right-0 top-12 z-20 w-72 rounded-3xl border border-border bg-card p-3 text-card-foreground shadow-lift">
          <button
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-bold text-muted-foreground hover:bg-slate-100 dark:text-muted-foreground dark:hover:bg-white/10"
            disabled={pending}
            onClick={toggleArchive}
            type="button"
          >
            {archived ? (
              <ArchiveRestore className="h-4 w-4" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            {archived ? "Restore conversation" : "Archive conversation"}
          </button>
          <button
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-bold text-muted-foreground hover:bg-slate-100 dark:text-muted-foreground dark:hover:bg-white/10"
            disabled={pending}
            onClick={toggleBlock}
            type="button"
          >
            <Ban className="h-4 w-4" />{" "}
            {blocked ? "Unblock user" : "Block user"}
          </button>
          <button
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-400/10"
            onClick={() => setReporting((current) => !current)}
            type="button"
          >
            <Flag className="h-4 w-4" /> Report conversation
          </button>
          <button
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-400/10"
            disabled={pending}
            onClick={clearConversation}
            type="button"
          >
            <Trash2 className="h-4 w-4" /> Delete for me
          </button>
          {reporting ? (
            <form
              action={submitReport}
              className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-white/10"
            >
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5"
                name="reason"
              >
                {reasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason[0] + reason.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
              <textarea
                className="min-h-20 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                maxLength={1000}
                name="details"
                placeholder="Optional details"
              />
              <Button
                disabled={pending}
                fullWidth
                size="sm"
                type="submit"
                variant="danger"
              >
                Submit report
              </Button>
            </form>
          ) : null}
          {status ? (
            <p className="px-3 pt-2 text-xs text-muted-foreground">{status}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
