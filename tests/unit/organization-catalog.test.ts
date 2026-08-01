import { describe, expect, it } from "vitest";
import { DISCOVER_PROVIDERS } from "@/features/discover/registry";
import { hasOrganizationPermission } from "@/lib/organization-authorization";
import {
  CatalogLifecycleError,
  catalogTransitionTarget,
} from "@/lib/organization-catalog-lifecycle";
import {
  catalogCapability,
  catalogPermission,
} from "@/lib/organization-catalog-permissions";
import { canExposeCatalogResource } from "@/lib/organization-catalog-visibility";
import {
  paymentCapability,
  PaymentProviderUnavailableError,
  requirePaymentProvider,
} from "@/lib/payments/orchestration";

describe("organization catalog lifecycle", () => {
  it("keeps product and service lifecycle actions structurally separate", () => {
    expect(
      catalogTransitionTarget({
        kind: "product",
        from: "DRAFT",
        action: "SUBMIT",
      }),
    ).toBe("PENDING_REVIEW");
    expect(
      catalogTransitionTarget({
        kind: "product",
        from: "PUBLISHED",
        action: "OUT_OF_STOCK",
      }),
    ).toBe("OUT_OF_STOCK");
    expect(() =>
      catalogTransitionTarget({
        kind: "service",
        from: "PUBLISHED",
        action: "OUT_OF_STOCK",
      }),
    ).toThrow(CatalogLifecycleError);
  });

  it("does not let removed resources return directly to public", () => {
    expect(() =>
      catalogTransitionTarget({
        kind: "product",
        from: "REMOVED",
        action: "RESUME",
      }),
    ).toThrow(/cannot move/i);
  });
});

describe("organization catalog authorization and visibility", () => {
  const baseVisibility = {
    status: "PUBLISHED",
    publicationBlockedAt: null,
    organizationLifecycle: "ACTIVE",
    organizationPublicProfileStatus: "PUBLISHED",
    organizationPublicProfileBlockedAt: null,
    capabilityEnabled: true,
  };

  it("requires every public exposure gate", () => {
    expect(canExposeCatalogResource(baseVisibility)).toBe(true);
    expect(
      canExposeCatalogResource({
        ...baseVisibility,
        organizationLifecycle: "SUSPENDED",
      }),
    ).toBe(false);
    expect(
      canExposeCatalogResource({ ...baseVisibility, capabilityEnabled: false }),
    ).toBe(false);
    expect(
      canExposeCatalogResource({
        ...baseVisibility,
        publicationBlockedAt: new Date(),
      }),
    ).toBe(false);
  });

  it("keeps capability selection separate from member permission", () => {
    expect(catalogCapability("product")).toBe("PRODUCTS");
    expect(catalogPermission("service", "publish")).toBe(
      "ORGANIZATION_PUBLISH_SERVICES",
    );
    expect(
      hasOrganizationPermission(
        { role: "EDITOR", status: "ACTIVE" },
        "ORGANIZATION_EDIT_PRODUCTS",
      ),
    ).toBe(true);
    expect(
      hasOrganizationPermission(
        { role: "EDITOR", status: "ACTIVE" },
        "ORGANIZATION_PUBLISH_PRODUCTS",
      ),
    ).toBe(false);
  });
});

describe("Discover source ownership", () => {
  it("registers professional catalog separately from peer Marketplace", () => {
    const providers = new Map(
      DISCOVER_PROVIDERS.map((provider) => [provider.key, provider]),
    );
    expect(providers.get("products")?.analyticsSource).toBe(
      "organization-product",
    );
    expect(providers.get("services")?.analyticsSource).toBe(
      "organization-service",
    );
    expect(providers.get("marketplace")?.analyticsSource).toBe(
      "peer-marketplace",
    );
  });
});

describe("payment-ready foundation", () => {
  it("never exposes fake payment availability or currencies", () => {
    expect(paymentCapability.enabled).toBe(false);
    expect(paymentCapability.providerName).toBeNull();
    expect(paymentCapability.supportedCurrencies).toEqual([]);
    expect(() => requirePaymentProvider()).toThrow(
      PaymentProviderUnavailableError,
    );
  });
});
