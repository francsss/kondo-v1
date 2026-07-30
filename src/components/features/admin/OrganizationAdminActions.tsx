"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function OrganizationAdminActions({
  organizationId,
  lifecycleStatus,
  verificationStatus,
  isOfficialPartner,
  canManageLifecycle,
  canManagePartner,
}: {
  organizationId: string;
  lifecycleStatus: string;
  verificationStatus: string;
  isOfficialPartner: boolean;
  canManageLifecycle: boolean;
  canManagePartner: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);

  async function mutate(
    key: string,
    path: string,
    body: Record<string, unknown>,
  ) {
    setPending(key);
    setFeedback("");
    setIsError(false);
    try {
      const response = await fetch(path, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback(data.error ?? "The organization could not be updated.");
        setIsError(true);
        return;
      }
      setFeedback("Organization updated and recorded in the audit log.");
      router.refresh();
    } catch {
      setFeedback("Kondo could not reach the server.");
      setIsError(true);
    } finally {
      setPending("");
    }
  }

  async function updateLifecycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = String(form.get("status") ?? "");
    const reason = String(form.get("reason") ?? "");
    if (
      !window.confirm(
        `Change this organization from ${lifecycleStatus.toLowerCase()} to ${status.toLowerCase()}?`,
      )
    )
      return;
    await mutate(
      "lifecycle",
      `/api/admin/organizations/${organizationId}/lifecycle`,
      { status, reason },
    );
  }

  async function updatePartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const reason = String(form.get("reason") ?? "");
    await mutate(
      "partner",
      `/api/admin/organizations/${organizationId}/partner`,
      { isOfficialPartner: !isOfficialPartner, reason },
    );
  }

  const lifecycleOptions =
    lifecycleStatus === "DRAFT"
      ? ["ACTIVE", "ARCHIVED"]
      : lifecycleStatus === "ACTIVE"
        ? ["SUSPENDED", "ARCHIVED"]
        : lifecycleStatus === "SUSPENDED"
          ? ["ACTIVE", "ARCHIVED"]
          : [];

  return (
    <div className="space-y-5">
      {canManageLifecycle && lifecycleOptions.length ? (
        <form
          className="rounded-3xl border border-border p-4"
          onSubmit={updateLifecycle}
        >
          <h3 className="font-black">Lifecycle control</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Suspending blocks normal publishing. Archiving is permanent in the
            current workflow. Personal member accounts are never changed.
          </p>
          <select
            className="mt-4 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
            defaultValue={lifecycleOptions[0]}
            name="status"
          >
            {lifecycleOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <textarea
            className="mt-3 min-h-24 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
            maxLength={1200}
            minLength={4}
            name="reason"
            placeholder="Required operational reason"
            required
          />
          <Button
            className="mt-3"
            disabled={pending === "lifecycle"}
            type="submit"
            variant="secondary"
          >
            {pending === "lifecycle" ? "Updating…" : "Apply lifecycle change"}
          </Button>
        </form>
      ) : null}

      {canManagePartner ? (
        <form
          className="rounded-3xl border border-border p-4"
          onSubmit={updatePartner}
        >
          <h3 className="font-black">Official Kondo partner</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            This is separate from verification and requires a verified
            organization. Current verification: {verificationStatus}.
          </p>
          <textarea
            className="mt-3 min-h-20 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
            maxLength={1200}
            minLength={4}
            name="reason"
            placeholder="Required partner-status reason"
            required
          />
          <Button
            className="mt-3"
            disabled={pending === "partner"}
            type="submit"
          >
            {pending === "partner"
              ? "Updating…"
              : isOfficialPartner
                ? "Remove partner status"
                : "Grant partner status"}
          </Button>
        </form>
      ) : null}

      {feedback ? (
        <p
          className={
            isError
              ? "rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive"
              : "rounded-2xl bg-kondo-mint px-4 py-3 text-sm font-semibold text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
          }
          role={isError ? "alert" : "status"}
        >
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
