"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function OrganizationPublicAdminActions({
  organizationId,
  publicProfileStatus,
  blocked,
  canModerate,
  canUnpublish,
  canRestore,
}: {
  organizationId: string;
  publicProfileStatus: string;
  blocked: boolean;
  canModerate: boolean;
  canUnpublish: boolean;
  canRestore: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const action = String(form.get("action") || "");
    const reason = String(form.get("reason") || "");
    if (
      action === "UNPUBLISH" &&
      !window.confirm(
        "Unpublish this organization profile? Its data will remain available to the organization team.",
      )
    ) {
      return;
    }
    setPending(action);
    setFeedback("");
    setIsError(false);
    try {
      const response = await fetch(
        `/api/admin/organizations/${organizationId}/public-profile`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback(data.error || "The public profile could not be moderated.");
        setIsError(true);
        return;
      }
      setFeedback(
        "Public-profile action recorded and the organization notified.",
      );
      event.currentTarget.reset();
      router.refresh();
    } catch {
      setFeedback("Kondo could not reach the server.");
      setIsError(true);
    } finally {
      setPending("");
    }
  }

  const actions = [
    canModerate
      ? {
          value: "REQUEST_CORRECTION",
          label: "Request a correction",
          help: "Keep the current visibility while asking managers to review the profile.",
        }
      : null,
    canUnpublish && publicProfileStatus === "PUBLISHED"
      ? {
          value: "UNPUBLISH",
          label: "Unpublish and restrict",
          help: "Remove the public route immediately without deleting profile data.",
        }
      : null,
    canRestore && blocked
      ? {
          value: "RESTORE",
          label: "Lift moderation restriction",
          help: "Allow the organization to correct and republish under the normal readiness rules.",
        }
      : null,
  ].filter(Boolean) as Array<{
    value: string;
    label: string;
    help: string;
  }>;

  if (!actions.length) return null;

  return (
    <form className="rounded-3xl border border-border p-4" onSubmit={submit}>
      <h3 className="font-black">Public-profile moderation</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Prefer a correction request unless immediate public removal is needed.
        Every action is audited.
      </p>
      <select
        className="mt-4 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm font-bold"
        name="action"
      >
        {actions.map((action) => (
          <option key={action.value} value={action.value}>
            {action.label}
          </option>
        ))}
      </select>
      <div className="mt-2 space-y-1">
        {actions.map((action) => (
          <p className="text-[11px] text-muted-foreground" key={action.value}>
            <strong>{action.label}:</strong> {action.help}
          </p>
        ))}
      </div>
      <textarea
        className="mt-3 min-h-24 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
        maxLength={1200}
        minLength={10}
        name="reason"
        placeholder="Required user-visible reason"
        required
      />
      <Button className="mt-3" disabled={Boolean(pending)} type="submit">
        {pending ? "Applying…" : "Apply public-profile action"}
      </Button>
      {feedback ? (
        <p
          className={
            isError
              ? "mt-3 rounded-2xl bg-destructive/10 p-3 text-xs font-semibold text-destructive"
              : "mt-3 rounded-2xl bg-kondo-mint p-3 text-xs font-semibold text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
          }
          role={isError ? "alert" : "status"}
        >
          {feedback}
        </p>
      ) : null}
    </form>
  );
}
