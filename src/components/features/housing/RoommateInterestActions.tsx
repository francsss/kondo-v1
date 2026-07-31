"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function RoommateInterestActions({
  conversationId,
  direction,
  interestId,
  status,
}: {
  conversationId: string | null;
  direction: "SENT" | "RECEIVED";
  interestId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(action: "accept" | "decline" | "withdraw") {
    if (busy) return;
    setBusy(true);
    setError(null);
    const response = await fetch(
      `/api/housing/roommate-interests/${interestId}/${action}`,
      { method: "POST", credentials: "include" },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error ?? "This interest could not be updated.");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  if (conversationId && status === "ACCEPTED") {
    return (
      <Button asChild size="sm">
        <Link href={`/messages/${conversationId}`}>Open conversation</Link>
      </Button>
    );
  }
  if (status !== "SENT") {
    return (
      <p className="text-xs font-bold capitalize text-muted-foreground">
        {status.toLowerCase()}
      </p>
    );
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {direction === "RECEIVED" ? (
          <>
            <Button
              disabled={busy}
              onClick={() => transition("accept")}
              size="sm"
            >
              Accept
            </Button>
            <Button
              disabled={busy}
              onClick={() => transition("decline")}
              size="sm"
              variant="secondary"
            >
              Decline
            </Button>
          </>
        ) : (
          <Button
            disabled={busy}
            onClick={() => transition("withdraw")}
            size="sm"
            variant="secondary"
          >
            Withdraw
          </Button>
        )}
      </div>
      {error ? (
        <p
          aria-live="assertive"
          className="mt-2 text-xs font-bold text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
