"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function HousingAdminActions({
  canRemove,
  canReview,
  listingId,
  status,
}: {
  canRemove: boolean;
  canReview: boolean;
  listingId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(action: "publish" | "reject" | "remove") {
    const reason =
      action === "publish"
        ? undefined
        : window.prompt(
            action === "reject"
              ? "Explain what the publisher must correct."
              : "Explain the safety or policy reason for removal.",
          );
    if (action !== "publish" && !reason) return;
    setBusy(true);
    setError(null);
    const response = await fetch(
      `/api/housing/listings/${listingId}/${action}`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) setError(payload?.error ?? "Moderation action failed.");
    else router.refresh();
    setBusy(false);
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {canReview && status === "PENDING_REVIEW" ? (
          <>
            <Button disabled={busy} onClick={() => act("publish")} size="sm">
              Approve
            </Button>
            <Button
              disabled={busy}
              onClick={() => act("reject")}
              size="sm"
              variant="secondary"
            >
              Request changes
            </Button>
          </>
        ) : null}
        {canRemove && (status === "PUBLISHED" || status === "PAUSED") ? (
          <Button
            disabled={busy}
            onClick={() => act("remove")}
            size="sm"
            variant="danger"
          >
            Remove
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-xs font-bold text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
