"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { startPendingOrderPolling } from "@/lib/payments/alipay-order-presentation";

export function PendingOrderRefresh() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(
    () =>
      startPendingOrderPolling({
        refresh: () => router.refresh(),
        isVisible: () => document.visibilityState === "visible",
        onTimeout: () => setTimedOut(true),
        now: () => Date.now(),
        schedule: (callback, delay) => window.setTimeout(callback, delay),
        cancel: (timeout) => window.clearTimeout(timeout),
      }),
    [router],
  );

  if (!timedOut) return null;
  return (
    <div className="mb-4 rounded-2xl border border-border bg-card px-4 py-3 text-center text-sm text-muted-foreground">
      Payment confirmation is taking longer than expected.
      <Button className="ml-3" onClick={() => router.refresh()} size="sm">
        Refresh status
      </Button>
    </div>
  );
}
