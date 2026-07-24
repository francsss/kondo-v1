"use client";

import { Check, Clock3, LockKeyhole, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

export function CommunityJoinButton({
  communityId,
  initialJoined,
  initialPending = false,
  joinPolicy = "OPEN",
  inverse = false,
}: {
  communityId: string;
  initialJoined: boolean;
  initialPending?: boolean;
  joinPolicy?: "OPEN" | "REQUEST" | "INVITE_ONLY";
  inverse?: boolean;
}) {
  const [joined, setJoined] = useState(initialJoined);
  const [pending, setPending] = useState(initialPending);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (!joined && pending) return;
    const next = !joined;
    setLoading(true);
    setError("");
    const response = await fetch(`/api/communities/${communityId}/members`, {
      method: next ? "POST" : "DELETE",
      credentials: "include",
      headers: next ? { "Content-Type": "application/json" } : undefined,
      body: next ? JSON.stringify({}) : undefined,
    }).catch(() => null);
    setLoading(false);
    if (!response?.ok) {
      const payload = await response?.json().catch(() => null);
      setError(payload?.error ?? "Could not update membership.");
      return;
    }
    if (next) {
      const payload = await response.json().catch(() => null);
      setJoined(payload?.state === "JOINED");
      setPending(payload?.state === "PENDING");
      if (payload?.state === "JOINED") {
        captureProductEvent(PRODUCT_EVENTS.COMMUNITY_JOINED, {
          community_id: communityId,
          join_policy: joinPolicy,
        });
      }
    } else {
      setJoined(false);
      setPending(false);
      captureProductEvent(PRODUCT_EVENTS.COMMUNITY_LEFT, {
        community_id: communityId,
      });
    }
  }

  return (
    <Button
      className={
        inverse
          ? "bg-white text-kondo-forest shadow-none hover:bg-kondo-lime"
          : undefined
      }
      disabled={loading}
      onClick={toggle}
      size="sm"
      type="button"
      variant={inverse ? "primary" : joined ? "secondary" : "soft"}
    >
      {joined ? (
        <Check className="h-4 w-4" />
      ) : pending ? (
        <Clock3 className="h-4 w-4" />
      ) : joinPolicy === "INVITE_ONLY" ? (
        <LockKeyhole className="h-4 w-4" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
      {loading
        ? "Updating…"
        : joined
          ? "Joined"
          : pending
            ? "Requested"
            : joinPolicy === "REQUEST"
              ? "Request"
              : joinPolicy === "INVITE_ONLY"
                ? "Accept invite"
                : "Join"}
      {error ? <span className="sr-only">{error}</span> : null}
    </Button>
  );
}
