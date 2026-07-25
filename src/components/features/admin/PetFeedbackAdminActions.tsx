"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, MessageSquarePlus, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";

type FeedbackStatus = "NEW" | "IN_PROGRESS" | "RESOLVED";

export function PetFeedbackAdminActions({
  feedbackId,
  initialStatus,
  initialVersion,
  canManage,
}: {
  feedbackId: string;
  initialStatus: FeedbackStatus;
  initialVersion: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [savedStatus, setSavedStatus] = useState(initialStatus);
  const [version, setVersion] = useState(initialVersion);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);

  async function request(path: string, method: "POST" | "PATCH", body: object) {
    setPending(true);
    setFeedback("");
    setIsError(false);
    try {
      const response = await fetch(path, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "The update could not be saved.");
      }
      return payload;
    } catch (error) {
      setIsError(true);
      setFeedback(
        error instanceof Error
          ? error.message
          : "The update could not reach the server.",
      );
      return null;
    } finally {
      setPending(false);
    }
  }

  async function updateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = await request(
      `/api/admin/feedback/${feedbackId}`,
      "PATCH",
      { status, expectedVersion: version },
    );
    if (!payload) return;
    setVersion(payload.feedback.version);
    setStatus(payload.feedback.status);
    setSavedStatus(payload.feedback.status);
    setFeedback(`Feedback moved to ${payload.feedback.status}.`);
    router.refresh();
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = String(formData.get("body") ?? "");
    const payload = await request(
      `/api/admin/feedback/${feedbackId}/notes`,
      "POST",
      { body },
    );
    if (!payload) return;
    form.reset();
    setFeedback("Internal note added.");
    router.refresh();
  }

  if (!canManage) {
    return (
      <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
        You have read-only access to this feedback.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <form
        className="rounded-3xl border border-border p-4"
        onSubmit={updateStatus}
      >
        <label className="text-sm font-black text-kondo-ink dark:text-white">
          Workflow status
          <select
            className="mt-2 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
            disabled={pending}
            onChange={(event) =>
              setStatus(event.target.value as FeedbackStatus)
            }
            value={status}
          >
            <option value="NEW">New</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </label>
        <Button
          className="mt-3"
          disabled={pending || status === savedStatus}
          fullWidth
          size="sm"
          type="submit"
        >
          {pending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save status
        </Button>
      </form>

      <form className="rounded-3xl border border-border p-4" onSubmit={addNote}>
        <label className="text-sm font-black text-kondo-ink dark:text-white">
          Internal reply
          <textarea
            className="mt-2 min-h-28 w-full resize-y rounded-2xl border border-border bg-background p-3 text-sm leading-6 outline-none focus:border-kondo-green"
            disabled={pending}
            maxLength={2000}
            minLength={2}
            name="body"
            placeholder="Add context, a decision, or a follow-up for the Kondo team."
            required
          />
        </label>
        <Button
          className="mt-3"
          disabled={pending}
          fullWidth
          size="sm"
          type="submit"
          variant="secondary"
        >
          {pending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <MessageSquarePlus className="h-4 w-4" />
          )}
          Add internal note
        </Button>
      </form>

      {feedback ? (
        <p
          aria-live="polite"
          className={
            isError
              ? "rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300"
              : "rounded-2xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
          }
        >
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
