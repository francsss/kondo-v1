# Payment and university billing foundation

Status: **provider-disabled**

Last audited: 2026-08-01

Kondo is not presented as a bank, remittance provider, foreign-exchange
provider, custodian, or escrow provider. No live payment provider, currency,
university billing API, mobile-money network, quote, checkout, or settlement is
currently claimed.

## Separated contracts

`src/lib/payments/orchestration.ts` keeps the following concepts distinct:

- `PaymentInvoice`: source reference and optional amount; a manual upload is
  not official confirmation;
- `PaymentBeneficiary`: provider-owned beneficiary reference and verification;
- `ProviderQuote`: provider reference, amounts, currencies, and expiry;
- `PaymentIntent`: User intent tied to an invoice and optional quote;
- `ProviderTransaction`: provider status and settlement status;
- `PaymentReceipt`: created only from provider-confirmed completion;
- `PaymentStatus` and `SettlementStatus`: separate lifecycles.

These are adapter contracts, not operational persistence. A live integration
requires a reviewed additive schema migration, provider contract, compliance
review, webhook verification, reconciliation, refund/error policy, and end-to-
end production tests.

## Current runtime behavior

`paymentCapability.enabled` is `false`, the provider name is `null`, and the
supported currency/use-case arrays are empty. `/payments` explains the truthful
unavailable state. `/api/payments/capabilities` exposes only this non-sensitive
capability record and may be publicly cached for five minutes.

There is no functional Pay Now action. The client cannot choose a payment
status, exchange rate, provider, beneficiary, supported country, or currency.
No provider webhook exists, so no payment can become completed.

## University billing adapter states

The `UniversityBillingAdapter` boundary permits only a reviewed implementation:

1. official external payment link;
2. official QR/reference;
3. manual invoice import, explicitly unverified;
4. authorized payment-provider adapter;
5. future private university billing adapter.

Universities are never assumed to expose a public API. A configured adapter must
return the beneficiary, source reference, amount, currency, and provenance. A
missing adapter returns unavailable; it must not fabricate values.

## Provider responsibilities

A future authorized provider—not Kondo—must own collection, KYC/AML, FX,
cross-border transfer, settlement, regulated refunds, and transaction
confirmation. Provider credentials, raw payloads, webhook signatures, payment
credentials, and private invoice files must remain server-side and outside
analytics/notifications.

## Failure behavior

Provider unavailability must fail closed and must not affect Home, Student Hub,
Discover, Housing, Opportunities, Organizations, Communities, or Marketplace.
The release test asserts empty currency support and a deterministic
`PaymentProviderUnavailableError` when no adapter is supplied.
