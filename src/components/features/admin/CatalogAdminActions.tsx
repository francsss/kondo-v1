"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

type CatalogModerationAction =
  "REMOVE" | "RESTORE_FOR_REVIEW" | "BLOCK_EXTERNAL_URL";

export function CatalogAdminActions({
  externalUrlAvailable,
  kind,
  resourceId,
  status,
}: {
  externalUrlAvailable: boolean;
  kind: "products" | "services";
  resourceId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<CatalogModerationAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function moderate(action: CatalogModerationAction) {
    if (busy) return;
    const note = window.prompt(
      action === "REMOVE"
        ? "Document the safety or policy reason for removal."
        : action === "RESTORE_FOR_REVIEW"
          ? "Document why this item can return to review."
          : "Document why this external link is unsafe.",
    );
    if (!note) return;
    setBusy(action);
    setMessage(null);
    const response = await fetch(
      `/api/admin/catalog/${kind}/${resourceId}/moderate`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      },
    );
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setMessage(
      response.ok
        ? "Moderation decision saved."
        : (payload?.error ?? "The moderation decision could not be saved."),
    );
    if (response.ok) router.refresh();
    setBusy(null);
  }

  return (
    <div>
      <div className="flex flex-wrap justify-end gap-2">
        {status === "REMOVED" ? (
          <Button
            disabled={Boolean(busy)}
            onClick={() => void moderate("RESTORE_FOR_REVIEW")}
            size="sm"
            variant="secondary"
          >
            Restore for review
          </Button>
        ) : status !== "ARCHIVED" ? (
          <Button
            disabled={Boolean(busy)}
            onClick={() => void moderate("REMOVE")}
            size="sm"
            variant="danger"
          >
            Remove
          </Button>
        ) : null}
        {externalUrlAvailable ? (
          <Button
            disabled={Boolean(busy)}
            onClick={() => void moderate("BLOCK_EXTERNAL_URL")}
            size="sm"
            variant="secondary"
          >
            Block external link
          </Button>
        ) : null}
      </div>
      {message ? (
        <p className="mt-2 text-right text-xs font-semibold" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
