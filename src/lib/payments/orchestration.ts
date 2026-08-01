export type PaymentUseCase =
  | "TUITION"
  | "DORMITORY"
  | "INSURANCE"
  | "HOUSING"
  | "AIRPORT_PICKUP"
  | "ARRIVAL_SERVICE"
  | "ORGANIZATION_PRODUCT"
  | "ORGANIZATION_SERVICE";

export type PaymentCapability = {
  enabled: boolean;
  providerName: string | null;
  supportedUseCases: readonly PaymentUseCase[];
  supportedCurrencies: readonly string[];
  reason: string;
};

export type PaymentStatus =
  | "PREPARING"
  | "PROVIDER_REQUIRED"
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDED";

export type SettlementStatus =
  "NOT_STARTED" | "PENDING" | "SETTLED" | "FAILED" | "REVERSED";

/**
 * Payment-domain contracts are intentionally separate even while the provider
 * is disabled. They are adapter DTOs, not claims that a payment was processed
 * or that Kondo stores money. Persistence is introduced only with a reviewed,
 * licensed provider contract and a dedicated additive migration.
 */
export type PaymentInvoice = {
  id: string;
  useCase: PaymentUseCase;
  source: "OFFICIAL_LINK" | "OFFICIAL_QR" | "MANUAL_IMPORT" | "ADAPTER";
  sourceReference: string;
  beneficiaryId: string | null;
  amountMinor: number | null;
  currency: string | null;
  verifiedByAdapter: boolean;
};

export type PaymentBeneficiary = {
  id: string;
  displayName: string;
  providerBeneficiaryReference: string | null;
  verifiedByProvider: boolean;
};

export type PaymentIntent = {
  id: string;
  invoiceId: string;
  quoteReference: string | null;
  status: PaymentStatus;
  providerReference: string | null;
};

export type ProviderTransaction = {
  providerName: string;
  providerReference: string;
  paymentIntentId: string;
  status: PaymentStatus;
  settlementStatus: SettlementStatus;
  lastVerifiedAt: Date;
};

export type PaymentReceipt = {
  id: string;
  paymentIntentId: string;
  providerReference: string;
  issuedAt: Date;
  providerConfirmed: true;
};

export type ProviderQuote = {
  providerReference: string;
  sourceAmountMinor: number;
  sourceCurrency: string;
  destinationAmountMinor: number;
  destinationCurrency: string;
  expiresAt: Date;
};

export interface PaymentProviderAdapter {
  readonly providerName: string;
  capability(): Promise<PaymentCapability>;
  createQuote(input: {
    useCase: PaymentUseCase;
    invoiceReference: string;
    destinationAmountMinor: number;
    destinationCurrency: string;
    sourceCurrency: string;
  }): Promise<ProviderQuote>;
  getPaymentStatus(
    providerReference: string,
  ): Promise<
    Extract<
      PaymentStatus,
      "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED"
    >
  >;
}

export interface UniversityBillingAdapter {
  readonly universityId: string;
  resolveInvoice(reference: string): Promise<{
    beneficiaryName: string;
    amountMinor: number;
    currency: string;
    officialPaymentUrl?: string;
    officialQrMediaId?: string;
  } | null>;
}

/**
 * No provider contract is configured in Part 6. This explicit adapter state is
 * the only state exposed to the UI: it never manufactures rates, currencies,
 * channels or a successful transaction.
 */
export const paymentCapability: PaymentCapability = {
  enabled: false,
  providerName: null,
  supportedUseCases: [],
  supportedCurrencies: [],
  reason:
    "Kondo payments require an authorized payment partner. No provider is configured yet, so payment and currency conversion are unavailable.",
};

export class PaymentProviderUnavailableError extends Error {
  readonly status = 503;
  constructor() {
    super(paymentCapability.reason);
    this.name = "PaymentProviderUnavailableError";
  }
}

export function requirePaymentProvider(
  adapter?: PaymentProviderAdapter | null,
): PaymentProviderAdapter {
  if (!adapter) throw new PaymentProviderUnavailableError();
  return adapter;
}
