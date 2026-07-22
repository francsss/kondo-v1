"use client";

import { Phone, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { CallRoomOverlay } from "@/components/features/calls/CallRoomOverlay";
import { Button } from "@/components/ui/Button";

type AvailableCall = {
  id: string;
  kind: "AUDIO" | "VIDEO";
  createdById: string;
  status: "CONNECTING" | "ACTIVE";
};

export function ConversationCallButtons({
  conversationId,
}: {
  conversationId: string;
}) {
  const [call, setCall] = useState<AvailableCall | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function poll() {
      const response = await fetch(
        `/api/conversations/${conversationId}/calls`,
        {
          credentials: "include",
          cache: "no-store",
        },
      ).catch(() => null);
      const payload = await response?.json().catch(() => null);
      if (active && response?.ok && payload?.call) setCall(payload.call);
    }
    void poll();
    const interval = window.setInterval(poll, 3_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [conversationId]);

  async function start(kind: "AUDIO" | "VIDEO") {
    setPending(true);
    setError("");
    const response = await fetch(`/api/conversations/${conversationId}/calls`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    const payload = await response.json().catch(() => null);
    if (response.ok) setCall(payload.call);
    else setError(payload?.error ?? "The call could not start.");
    setPending(false);
  }

  return (
    <>
      <Button
        aria-label="Start audio call"
        disabled={pending}
        onClick={() => start("AUDIO")}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Phone className="h-5 w-5" />
      </Button>
      <Button
        aria-label="Start video call"
        disabled={pending}
        onClick={() => start("VIDEO")}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Video className="h-5 w-5" />
      </Button>
      {error ? (
        <span className="sr-only" role="alert">
          {error}
        </span>
      ) : null}
      {call ? (
        <CallRoomOverlay callId={call.id} onClose={() => setCall(null)} />
      ) : null}
    </>
  );
}
