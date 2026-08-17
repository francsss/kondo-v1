import type { StudyEssentialOrderStatus } from "@prisma/client";

const POLL_DELAYS_MS = [2_500, 5_000, 10_000, 20_000, 30_000] as const;
const MAX_POLL_DURATION_MS = 5 * 60_000;

export type AlipayOrderPresentation = {
  title: string;
  description: string;
  statusLabel: string;
  shouldPoll: boolean;
};

export function getAlipayOrderPresentation(
  status: StudyEssentialOrderStatus,
): AlipayOrderPresentation {
  if (status === "PAID") {
    return {
      title: "Order confirmed",
      description:
        "Alipay's signed server notification was verified. Your book access is now active.",
      statusLabel: "Paid (Alipay sandbox)",
      shouldPoll: false,
    };
  }
  if (status === "CANCELLED") {
    return {
      title: "Payment cancelled",
      description:
        "Alipay closed this sandbox transaction. No book access was granted.",
      statusLabel: "Cancelled",
      shouldPoll: false,
    };
  }
  if (status === "REFUNDED") {
    return {
      title: "Payment refunded",
      description:
        "This payment was refunded. Contact support if the refund is not visible in Alipay.",
      statusLabel: "Refunded",
      shouldPoll: false,
    };
  }
  if (status === "FAILED") {
    return {
      title: "Payment failed",
      description:
        "The sandbox payment could not be completed. No book access was granted.",
      statusLabel: "Failed",
      shouldPoll: false,
    };
  }
  if (status === "PENDING") {
    return {
      title: "Waiting for payment confirmation",
      description:
        "The order is pending. This page refreshes while Kondo waits for Alipay's signed server notification.",
      statusLabel: "Pending (Alipay sandbox)",
      shouldPoll: true,
    };
  }
  return status satisfies never;
}

export function nextPendingOrderPollDelay(
  attempt: number,
  elapsedMs: number,
): number | null {
  if (elapsedMs >= MAX_POLL_DURATION_MS) return null;
  const delay = POLL_DELAYS_MS[Math.min(attempt, POLL_DELAYS_MS.length - 1)];
  return Math.min(delay, MAX_POLL_DURATION_MS - elapsedMs);
}

type PendingOrderPollingOptions<Timeout> = {
  refresh: () => void;
  isVisible: () => boolean;
  onTimeout: () => void;
  now: () => number;
  schedule: (callback: () => void, delay: number) => Timeout;
  cancel: (timeout: Timeout) => void;
};

export function startPendingOrderPolling<Timeout>(
  options: PendingOrderPollingOptions<Timeout>,
) {
  const startedAt = options.now();
  let attempt = 0;
  let timeout: Timeout | undefined;
  let stopped = false;

  const scheduleNext = () => {
    if (stopped) return;
    const delay = nextPendingOrderPollDelay(attempt, options.now() - startedAt);
    if (delay === null) {
      options.onTimeout();
      return;
    }
    timeout = options.schedule(() => {
      if (options.isVisible()) {
        options.refresh();
        attempt += 1;
      }
      scheduleNext();
    }, delay);
  };

  scheduleNext();
  return () => {
    stopped = true;
    if (timeout !== undefined) options.cancel(timeout);
  };
}
