"use client";

import Link from "next/link";
import { Building2, Sparkles } from "lucide-react";
import { OfficialMark } from "@/components/features/official-profile/OfficialMark";
import { Card } from "@/components/ui/Card";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

export type OrganizationSearchResult = {
  id: string;
  slug: string;
  name: string;
  organizationType: string;
  organizationTypeLabel: string;
  shortDescription: string | null;
  cityName: string | null;
  countryName: string;
  verificationState: "VERIFIED" | "UNVERIFIED";
  partner: boolean;
};

export function OrganizationSearchResultCard({
  organization,
}: {
  organization: OrganizationSearchResult;
}) {
  return (
    <Link
      href={`/organizations/${organization.slug}`}
      onClick={() =>
        captureProductEvent(PRODUCT_EVENTS.ORGANIZATION_SEARCH_RESULT_OPENED, {
          organization_type: organization.organizationType,
          verification_state: organization.verificationState,
          partner: organization.partner,
        })
      }
    >
      <Card className="flex h-full items-center gap-4 transition hover:-translate-y-0.5 hover:shadow-soft">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
          <Building2 className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-kondo-green">
            {organization.organizationTypeLabel}
            {organization.partner ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-kondo-lime px-2 py-0.5 text-[9px] text-kondo-forest">
                <Sparkles className="h-2.5 w-2.5" />
                Partner
              </span>
            ) : null}
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-1.5 font-bold text-kondo-ink dark:text-white">
            <span className="truncate">{organization.name}</span>
            {organization.verificationState === "VERIFIED" ? (
              <OfficialMark
                organizationName={organization.name}
                organizationType={organization.organizationType}
              />
            ) : null}
          </span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">
            {[organization.cityName, organization.countryName]
              .filter(Boolean)
              .join(" · ")}
            {organization.verificationState === "UNVERIFIED"
              ? " · Unverified"
              : ""}
          </span>
          {organization.shortDescription ? (
            <span className="mt-1 line-clamp-1 block text-xs text-muted-foreground">
              {organization.shortDescription}
            </span>
          ) : null}
        </span>
      </Card>
    </Link>
  );
}
