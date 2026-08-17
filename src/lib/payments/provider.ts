/**
 * What Kondo needs from a payment provider, and nothing more.
 *
 * Alipay is first, WeChat Pay is expected, and the point of this file is that
 * neither of them appears anywhere else. A book page asks for a payment and
 * receives something to redirect to; a notification route asks for a
 * verification and receives a verdict. Where the signature algorithm lives,
 * what a gateway calls its trade number, which fields must be sorted before
 * hashing — none of that leaks out of the adapter.
 *
 * Deliberately small. This is the seam that stops provider details spreading,
 * not a payments framework.
 */

export type PaymentIntent = {
  /** Kondo's own order reference. The provider's `out_trade_no`. */
  reference: string;
  /** Integer minor units, from the database — never from the browser. */
  amountMinor: number;
  currency: string;
  subject: string;
  /** Where the member's browser lands afterwards. UX only, never authority. */
  returnUrl: string;
  /** Where the provider posts its verified result. */
  notifyUrl: string;
};

/**
 * How the browser is sent to the provider.
 *
 * A redirect is a URL to visit. A form is a self-submitting POST, which is
 * what several Chinese gateways require. Modelling both means the adapter
 * decides, and the page just renders what it is given.
 */
export type PaymentHandoff =
  | { kind: "redirect"; url: string }
  | {
      kind: "form";
      action: string;
      method: "POST";
      fields: Record<string, string>;
    };

/**
 * The verdict on an inbound notification.
 *
 * `verified` is only ever true when the provider's signature checked out
 * against its public key. Everything downstream keys off this single boolean,
 * so there is no path where an unverified notification settles an order.
 */
export type NotificationVerdict =
  | {
      verified: true;
      /** Kondo's order reference echoed back. */
      reference: string;
      /** The provider's own payment id, for reconciliation. */
      providerReference: string;
      /** Minor units, as the provider reports them. Compared against the order. */
      amountMinor: number;
      currency: string;
      status: "PAID" | "PENDING" | "FAILED" | "REFUNDED";
      /** Kept for dispute resolution. Never credentials. */
      raw: Record<string, string>;
    }
  | { verified: false; reason: string };

export type PaymentStatus = {
  status: "PAID" | "PENDING" | "FAILED" | "REFUNDED" | "UNKNOWN";
  providerReference?: string;
};

export interface PaymentProvider {
  readonly key: "SIMULATED" | "ALIPAY" | "WECHAT_PAY" | "CARD";
  /** False when credentials are absent, so callers can fail loudly and early. */
  isConfigured(): boolean;
  createPayment(intent: PaymentIntent): Promise<PaymentHandoff>;
  /**
   * Verify an inbound notification. Takes the raw body so the adapter can
   * verify the signature over exactly the bytes that were signed — parsing
   * first and re-serialising is how signature checks quietly stop working.
   */
  verifyNotification(rawBody: string): Promise<NotificationVerdict>;
  /**
   * What the provider expects written back on success. Alipay wants the literal
   * string `success`; anything else makes it retry.
   */
  notificationAcknowledgement(): string;
  getPaymentStatus(reference: string): Promise<PaymentStatus>;
}

export class PaymentConfigurationError extends Error {
  constructor(
    message: string,
    public readonly missing: string[] = [],
  ) {
    super(message);
    this.name = "PaymentConfigurationError";
  }
}
