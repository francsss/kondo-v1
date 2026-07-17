"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type AssignableUser = {
  id: string;
  fullName: string;
  role?: string;
};

type ReportPermissions = {
  canClaim: boolean;
  canAssignAny: boolean;
  canAddNote: boolean;
  canTransition: boolean;
  canReopen: boolean;
};

export function ReportCaseActions({
  reportId,
  currentUserId,
  initialStatus,
  initialVersion,
  initialAssigneeId,
  permissions,
  assignableUsers,
}: {
  reportId: string;
  currentUserId: string;
  initialStatus: "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED";
  initialVersion: number;
  initialAssigneeId: string | null;
  permissions: ReportPermissions;
  assignableUsers: AssignableUser[];
}) {
  const router = useRouter();
  const [version, setVersion] = useState(initialVersion);
  const [status, setStatus] = useState(initialStatus);
  const [assigneeId, setAssigneeId] = useState(initialAssigneeId);
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState(false);

  async function post(path: string, body: object) {
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setFeedback(payload?.error ?? "The moderation action failed.");
        return null;
      }
      return payload;
    } catch {
      setFeedback("The moderation action could not reach the server.");
      return null;
    } finally {
      setPending(false);
    }
  }

  async function assign(nextAssigneeId: string | null) {
    const payload = await post(`/api/admin/reports/${reportId}/assignment`, {
      assigneeId: nextAssigneeId,
      expectedVersion: version,
    });
    if (!payload) return;
    setVersion(payload.report.version);
    setStatus(payload.report.status);
    setAssigneeId(payload.report.assigneeId);
    setFeedback(nextAssigneeId ? "Assignment updated." : "Report unassigned.");
    router.refresh();
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = String(form.get("assigneeId") ?? "");
    await assign(value || null);
  }

  async function transition(
    nextStatus: "REVIEWING" | "RESOLVED" | "DISMISSED",
    formData?: FormData,
  ) {
    const payload = await post(`/api/admin/reports/${reportId}/transition`, {
      status: nextStatus,
      expectedVersion: version,
      decision: formData?.get("decision") || undefined,
      resolution: formData?.get("resolution") || undefined,
    });
    if (!payload) return;
    setVersion(payload.report.version);
    setStatus(payload.report.status);
    setAssigneeId(payload.report.assigneeId);
    setFeedback(`Report moved to ${payload.report.status}.`);
    router.refresh();
  }

  async function addNote(formData: FormData) {
    const body = String(formData.get("body") ?? "");
    const payload = await post(`/api/admin/reports/${reportId}/notes`, {
      body,
    });
    if (!payload) return;
    setFeedback("Internal note added.");
    router.refresh();
  }

  const terminal = status === "RESOLVED" || status === "DISMISSED";

  return (
    <div className="space-y-5">
      {permissions.canAssignAny && !terminal ? (
        <form
          className="rounded-3xl border border-slate-200 p-4 dark:border-white/10"
          onSubmit={submitAssignment}
        >
          <label className="text-sm font-black text-kondo-ink dark:text-white">
            Assignment
            <select
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5"
              defaultValue={assigneeId ?? ""}
              name="assigneeId"
            >
              <option value="">Unassigned</option>
              {assignableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName} · {user.role}
                </option>
              ))}
            </select>
          </label>
          <Button
            className="mt-3"
            disabled={pending}
            size="sm"
            type="submit"
            variant="secondary"
          >
            Update assignment
          </Button>
        </form>
      ) : null}

      {!permissions.canAssignAny &&
      permissions.canClaim &&
      !assigneeId &&
      status === "OPEN" ? (
        <Button
          disabled={pending}
          fullWidth
          onClick={() => assign(currentUserId)}
          type="button"
        >
          Claim and start review
        </Button>
      ) : null}

      {permissions.canTransition && status === "OPEN" ? (
        <Button
          disabled={pending}
          fullWidth
          onClick={() => transition("REVIEWING")}
          type="button"
        >
          Start review
        </Button>
      ) : null}

      {permissions.canTransition && status === "REVIEWING" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <form
            action={(formData) => transition("RESOLVED", formData)}
            className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/5"
          >
            <p className="font-black text-kondo-ink dark:text-white">Resolve</p>
            <select
              className="mt-3 h-11 w-full rounded-2xl border border-emerald-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5"
              name="decision"
            >
              <option value="VIOLATION_CONFIRMED">Violation confirmed</option>
              <option value="ESCALATED">Escalated</option>
              <option value="OTHER">Other decision</option>
            </select>
            <textarea
              className="mt-3 min-h-28 w-full rounded-2xl border border-emerald-200 bg-white p-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
              maxLength={2000}
              minLength={10}
              name="resolution"
              placeholder="Decision and operational resolution"
              required
            />
            <Button
              className="mt-3"
              disabled={pending}
              fullWidth
              size="sm"
              type="submit"
            >
              Resolve report
            </Button>
          </form>
          <form
            action={(formData) => transition("DISMISSED", formData)}
            className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <p className="font-black text-kondo-ink dark:text-white">Dismiss</p>
            <select
              className="mt-3 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5"
              name="decision"
            >
              <option value="NO_VIOLATION">No violation</option>
              <option value="INSUFFICIENT_EVIDENCE">
                Insufficient evidence
              </option>
              <option value="DUPLICATE">Duplicate</option>
              <option value="OUT_OF_SCOPE">Out of scope</option>
              <option value="OTHER">Other decision</option>
            </select>
            <textarea
              className="mt-3 min-h-28 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
              maxLength={2000}
              minLength={10}
              name="resolution"
              placeholder="Why this report is being dismissed"
              required
            />
            <Button
              className="mt-3"
              disabled={pending}
              fullWidth
              size="sm"
              type="submit"
              variant="secondary"
            >
              Dismiss report
            </Button>
          </form>
        </div>
      ) : null}

      {terminal && permissions.canReopen ? (
        <form
          action={(formData) => transition("REVIEWING", formData)}
          className="rounded-3xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-400/20 dark:bg-orange-400/5"
        >
          <p className="font-black text-kondo-ink dark:text-white">
            Controlled reopening
          </p>
          <textarea
            className="mt-3 min-h-24 w-full rounded-2xl border border-orange-200 bg-white p-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
            maxLength={2000}
            minLength={10}
            name="resolution"
            placeholder="Reason for reopening this closed report"
            required
          />
          <Button
            className="mt-3"
            disabled={pending}
            size="sm"
            type="submit"
            variant="secondary"
          >
            Reopen report
          </Button>
        </form>
      ) : null}

      {permissions.canAddNote ? (
        <form
          action={addNote}
          className="rounded-3xl border border-slate-200 p-4 dark:border-white/10"
        >
          <label className="text-sm font-black text-kondo-ink dark:text-white">
            Internal note
            <textarea
              className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm font-normal outline-none dark:border-white/10 dark:bg-white/5"
              maxLength={2000}
              minLength={2}
              name="body"
              placeholder="Visible only to authorized operations staff"
              required
            />
          </label>
          <Button
            className="mt-3"
            disabled={pending}
            size="sm"
            type="submit"
            variant="secondary"
          >
            Add internal note
          </Button>
        </form>
      ) : null}

      {feedback ? (
        <p
          className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600 dark:bg-white/5 dark:text-slate-300"
          role="status"
        >
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
