"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type AccountRequest = {
  id: string;
  type: "DATA_EXPORT" | "ACCOUNT_DELETION";
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "REJECTED" | "CANCELLED";
  reason: string | null;
  responseNote: string | null;
  version: number;
  createdAt: string;
};

export function AccountRequestPanel({
  requests,
}: {
  requests: AccountRequest[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function create(type: AccountRequest["type"], reason?: string) {
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch("/api/account/requests", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, reason: reason || undefined }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback(payload.error ?? "Request could not be created.");
        return;
      }
      setFeedback("Request recorded.");
      router.refresh();
    } catch {
      setFeedback("Request could not be created.");
    } finally {
      setPending(false);
    }
  }

  async function requestDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
    await create("ACCOUNT_DELETION", reason);
  }

  async function cancel(request: AccountRequest) {
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/account/requests/${request.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: request.version }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback(payload.error ?? "Request could not be cancelled.");
        return;
      }
      setFeedback("Request cancelled.");
      router.refresh();
    } catch {
      setFeedback("Request could not be cancelled.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <h2 className="font-black text-kondo-ink dark:text-white">
        Your data and account
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">
        These controls create reviewed requests. They do not immediately erase
        data or deactivate your account.
      </p>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
          <Download className="h-5 w-5 text-kondo-green" />
          <p className="mt-3 font-bold text-kondo-ink dark:text-white">
            Data export
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Ask Kondo operations to prepare a portable copy of your account
            data.
          </p>
          <Button
            className="mt-4"
            disabled={pending}
            onClick={() => create("DATA_EXPORT")}
            size="sm"
            type="button"
            variant="secondary"
          >
            Request export
          </Button>
        </div>
        <form
          className="rounded-2xl border border-red-200 bg-red-50/60 p-4 dark:border-red-400/20 dark:bg-red-400/5"
          onSubmit={requestDeletion}
        >
          <Trash2 className="h-5 w-5 text-red-600" />
          <p className="mt-3 font-bold text-kondo-ink dark:text-white">
            Account deletion
          </p>
          <textarea
            className="mt-3 min-h-20 w-full rounded-xl border border-red-200 bg-white p-3 text-sm outline-none dark:border-red-400/20 dark:bg-white/5"
            maxLength={1000}
            minLength={10}
            name="reason"
            placeholder="Tell us why you want the account deleted."
            required
          />
          <Button
            className="mt-3"
            disabled={pending}
            size="sm"
            type="submit"
            variant="danger"
          >
            Request deletion
          </Button>
        </form>
      </div>
      {feedback ? (
        <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
          {feedback}
        </p>
      ) : null}
      <div className="mt-6 space-y-3">
        {requests.map((request) => (
          <div
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center dark:border-white/10"
            key={request.id}
          >
            <div className="min-w-0 flex-1">
              <p className="font-bold text-kondo-ink dark:text-white">
                {request.type === "DATA_EXPORT"
                  ? "Data export"
                  : "Account deletion"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {request.status} ·{" "}
                {new Date(request.createdAt).toLocaleDateString()}
              </p>
              {request.responseNote ? (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                  {request.responseNote}
                </p>
              ) : null}
            </div>
            {request.status === "PENDING" ? (
              <Button
                disabled={pending}
                onClick={() => cancel(request)}
                size="sm"
                type="button"
                variant="ghost"
              >
                <X className="h-4 w-4" /> Cancel
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
