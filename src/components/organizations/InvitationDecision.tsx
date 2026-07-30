"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function InvitationDecision({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  async function decide(action: "ACCEPT" | "DECLINE") {
    setLoading(action);
    setError("");
    try {
      const response = await fetch(
        `/api/organization-invitations/${invitationId}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "The invitation could not be updated.");
        return;
      }
      if (action === "ACCEPT") {
        router.replace(`/organizations/${data.invitation.slug}/dashboard`);
      } else {
        router.replace("/home");
      }
      router.refresh();
    } catch {
      setError("Kondo could not reach the server.");
    } finally {
      setLoading("");
    }
  }

  return (
    <div>
      {error ? (
        <p
          className="mb-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-3">
        <Button disabled={Boolean(loading)} onClick={() => decide("ACCEPT")}>
          {loading === "ACCEPT" ? "Joining…" : "Accept invitation"}
        </Button>
        <Button
          disabled={Boolean(loading)}
          onClick={() => decide("DECLINE")}
          variant="ghost"
        >
          Decline
        </Button>
      </div>
    </div>
  );
}
