"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function SellerListingActions({
  listingId,
  status,
}: {
  listingId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function transition(next: string) {
    setPending(true);
    setError("");
    const response = await fetch(`/api/marketplace/${listingId}/status`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: next,
        ...(next === "ACTIVE" ? { expiresInDays: 30 } : {}),
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setPending(false);
    if (!response?.ok) {
      setError(payload?.error ?? "Could not update listing.");
      return;
    }
    router.refresh();
  }

  const actions =
    status === "DRAFT"
      ? [
          ["ACTIVE", "Publish"],
          ["ARCHIVED", "Archive"],
        ]
      : status === "EXPIRED"
        ? [
            ["ACTIVE", "Renew"],
            ["ARCHIVED", "Archive"],
          ]
      : status === "ACTIVE"
        ? [
            ["RESERVED", "Reserve"],
            ["SOLD", "Mark sold"],
            ["ARCHIVED", "Archive"],
          ]
        : status === "RESERVED"
          ? [
              ["ACTIVE", "Make active"],
              ["SOLD", "Mark sold"],
              ["ARCHIVED", "Archive"],
            ]
          : status === "SOLD"
            ? [["ARCHIVED", "Archive"]]
            : status === "ARCHIVED"
              ? [["ACTIVE", "Republish"]]
                : [];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {actions.map(([next, label]) => (
          <Button
            disabled={pending}
            key={next}
            onClick={() => transition(next)}
            size="sm"
            type="button"
            variant={next === "SOLD" ? "primary" : "secondary"}
          >
            {label}
          </Button>
        ))}
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
