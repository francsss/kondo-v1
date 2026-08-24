"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * The way into a listing's conversation.
 *
 * This used to be a link into `/messages/new`, which meant a marketplace
 * enquiry became an ordinary direct message: same thread as every other
 * conversation with that person, and no record of which listing it was about.
 * Worse, if the two had ever spoken before, the link redirected straight into
 * that existing thread and the listing was dropped entirely.
 *
 * It posts now, because opening the thread writes a row. A link would be
 * prefetched by the router the moment the button came into view, and sellers
 * would collect conversations from people who only scrolled past.
 */
export function ContactSellerButton({
  className,
  listingId,
  label = "Chat with seller",
}: {
  className?: string;
  listingId: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function openConversation() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/marketplace/${listingId}/conversation`,
        { method: "POST", credentials: "include" },
      );
      const payload = (await response.json().catch(() => null)) as {
        conversationId?: string;
        error?: string;
      } | null;
      if (!response.ok || !payload?.conversationId) {
        throw new Error(payload?.error ?? "Could not open this conversation.");
      }
      router.push(`/marketplace/messages/${payload.conversationId}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not open this conversation.",
      );
      setPending(false);
    }
  }

  return (
    <div className={cn("min-w-0", className)}>
      <Button
        className="w-full"
        disabled={pending}
        onClick={openConversation}
        type="button"
        variant="primary"
      >
        {pending ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <MessageCircle aria-hidden="true" className="h-4 w-4" />
        )}
        {label}
      </Button>
      {error ? (
        <p className="mt-2 text-xs font-semibold text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
