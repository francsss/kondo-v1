import { AlipayProvider } from "@/lib/payments/alipay";
import {
  PaymentConfigurationError,
  type PaymentProvider,
} from "@/lib/payments/provider";

/**
 * Which providers exist, and which one a request is allowed to use.
 *
 * Two guards live here rather than in the routes, so no route can forget them:
 * real money stays off unless the environment deliberately says otherwise, and
 * a provider with no credentials refuses loudly instead of behaving like a
 * mock that always succeeds. A payment that silently "works" without a gateway
 * is worse than one that fails, because it grants a book for nothing.
 */

const providers = new Map<string, PaymentProvider>([
  ["ALIPAY", new AlipayProvider()],
]);

export function getPaymentProvider(key: string): PaymentProvider {
  const provider = providers.get(key);
  if (!provider) {
    throw new PaymentConfigurationError(`Unknown payment provider: ${key}.`);
  }
  return provider;
}

/**
 * Sandbox unless production is explicitly and completely enabled.
 *
 * The default is deliberately the safe one: an environment that says nothing
 * is a sandbox. Turning real money on takes two independent statements, so it
 * cannot happen through a single stray variable.
 */
export function isProductionPaymentsEnabled() {
  return (
    process.env.ALIPAY_ENV?.trim() === "production" &&
    process.env.PAYMENTS_ALLOW_PRODUCTION?.trim() === "true"
  );
}

export function assertPaymentsUsable(provider: PaymentProvider) {
  if (!provider.isConfigured()) {
    throw new PaymentConfigurationError(
      `${provider.key} is not configured on this environment. Payment cannot be started.`,
    );
  }
  if (process.env.ALIPAY_ENV?.trim() === "production") {
    if (!isProductionPaymentsEnabled()) {
      throw new PaymentConfigurationError(
        "Production payments are not enabled. Set PAYMENTS_ALLOW_PRODUCTION=true deliberately to take real money.",
      );
    }
  }
}

/**
 * Whether a title may be sold at all right now.
 *
 * The pilot book is public domain. Charging for it in a real storefront would
 * misrepresent a free work as a commercial product, so a priced pilot title is
 * only purchasable while the pilot flag is on, and the UI says plainly that
 * the price is a sandbox simulation.
 */
export function isBooksPilotMode() {
  return process.env.BOOKS_PILOT_MODE?.trim() === "true";
}
