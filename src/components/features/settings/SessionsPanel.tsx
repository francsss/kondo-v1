"use client";

import {
  Laptop,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Session = {
  id: string;
  device: string;
  current: boolean;
  signedInAt: string;
  lastActiveAt: string;
  expiresAt: string;
};

export function SessionsPanel({
  initialSessions,
}: {
  initialSessions: Session[];
}) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/settings/sessions", {
      credentials: "include",
      cache: "no-store",
    }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setLoading(false);
    if (!response?.ok) {
      setFeedback(result?.error ?? "Sessions could not be loaded.");
      return;
    }
    setSessions(result.sessions);
  }

  async function revoke(session: Session) {
    setPending(true);
    setFeedback("");
    const response = await fetch(`/api/settings/sessions/${session.id}`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setPending(false);
    if (!response?.ok) {
      setFeedback(result?.error ?? "Session could not be revoked.");
      return;
    }
    if (result.current) {
      window.location.assign("/login");
      return;
    }
    setFeedback("Session revoked.");
    await load();
  }

  async function revokeMany(scope: "OTHERS" | "ALL") {
    setPending(true);
    setFeedback("");
    const response = await fetch("/api/settings/sessions", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope }),
    }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setPending(false);
    if (!response?.ok) {
      setFeedback(result?.error ?? "Sessions could not be revoked.");
      return;
    }
    if (result.current) {
      window.location.assign("/login");
      return;
    }
    setFeedback(
      result.revoked
        ? `${result.revoked} other session${result.revoked === 1 ? "" : "s"} revoked.`
        : "No other active sessions.",
    );
    await load();
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-black text-kondo-ink dark:text-white">
            Active sessions
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Review devices that can currently access your Kondo account.
          </p>
        </div>
        <Button
          disabled={loading || pending}
          onClick={() => load()}
          size="sm"
          type="button"
          variant="ghost"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>
      <div className="mt-5 space-y-3">
        {loading ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-400 dark:bg-white/5">
            Loading sessions…
          </p>
        ) : (
          sessions.map((session) => {
            const DeviceIcon = /iPhone|iPad|Android/.test(session.device)
              ? Smartphone
              : Laptop;
            return (
              <div
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center dark:border-white/10"
                key={session.id}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10 dark:text-emerald-300">
                  <DeviceIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-kondo-ink dark:text-white">
                      {session.device}
                    </p>
                    {session.current ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300">
                        <ShieldCheck className="h-3 w-3" /> Current
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Signed in {new Date(session.signedInAt).toLocaleString()} ·
                    expires {new Date(session.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  disabled={pending}
                  onClick={() => revoke(session)}
                  size="sm"
                  type="button"
                  variant={session.current ? "danger" : "secondary"}
                >
                  <LogOut className="h-4 w-4" />
                  {session.current ? "Sign out" : "Revoke"}
                </Button>
              </div>
            );
          })
        )}
      </div>
      {feedback ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">
          {feedback}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5 dark:border-white/10">
        <Button
          disabled={pending}
          onClick={() => revokeMany("OTHERS")}
          type="button"
          variant="secondary"
        >
          Sign out other devices
        </Button>
        <Button
          disabled={pending}
          onClick={() => revokeMany("ALL")}
          type="button"
          variant="danger"
        >
          Sign out everywhere
        </Button>
      </div>
    </Card>
  );
}
