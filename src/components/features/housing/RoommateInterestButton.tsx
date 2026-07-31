"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function RoommateInterestButton({
  recipientUserId,
}: {
  recipientUserId: string;
}) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">(
    "idle",
  );
  async function send() {
    if (state !== "idle" && state !== "error") return;
    setState("busy");
    const response = await fetch("/api/housing/roommate-interests", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientUserId }),
    });
    setState(response.ok ? "sent" : "error");
  }
  return (
    <Button
      disabled={state === "busy" || state === "sent"}
      onClick={send}
      size="sm"
      variant={state === "sent" ? "secondary" : "primary"}
    >
      {state === "busy"
        ? "Sending…"
        : state === "sent"
          ? "Interest sent"
          : state === "error"
            ? "Try again"
            : "I'm interested"}
    </Button>
  );
}
