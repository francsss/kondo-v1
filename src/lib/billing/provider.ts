export type BillingCheckoutInput = {
  userId: string;
  planKey: string;
  returnUrl: string;
};

export type BillingCheckoutSession = {
  provider: "ALIPAY";
  checkoutUrl: string;
  externalReference: string;
  expiresAt: Date;
};

export interface BillingProviderAdapter {
  readonly name: "ALIPAY";
  createCheckout(input: BillingCheckoutInput): Promise<BillingCheckoutSession>;
  verifyWebhook(
    rawBody: Uint8Array,
    headers: Headers,
  ): Promise<{ eventId: string; payload: unknown }>;
}

export class BillingNotConfiguredError extends Error {
  constructor() {
    super(
      "Meet Premium billing is not available yet. No payment has been created or charged.",
    );
    this.name = "BillingNotConfiguredError";
  }
}

/**
 * The adapter boundary is intentionally ready for an official Alipay
 * implementation. Kondo must not create subscriptions until a provider has
 * cryptographically verified a real payment event.
 */
export function getBillingProvider(): BillingProviderAdapter {
  throw new BillingNotConfiguredError();
}
