"use client";

import { useEffect, useState } from "react";
import { OfficialMark } from "@/components/features/official-profile/OfficialMark";
import { BackButton } from "@/components/ui/BackButton";
import { cn } from "@/lib/utils";

type ChromeOrganization = {
  name: string;
  logoUrl: string | null;
  verified: boolean;
  type: string;
};

/** The bar takes over once the cover has scrolled out of reach. */
const COMPACT_HEADER_OFFSET = 200;

/**
 * The only chrome a public organization page carries.
 *
 * There is deliberately no Kondo navigation, wordmark, search or account
 * control here: entering an organization should feel like entering that
 * organization's own space, not like browsing a Kondo tab. A single floating
 * back button sits over the cover, and once the cover scrolls away the bar
 * materialises with the organization's own identity — never Kondo's.
 */
export function OrganizationPublicChrome({
  backHref = "/organizations",
  backLabel = "Back",
  organization,
  overCover = true,
}: {
  backHref?: string;
  backLabel?: string;
  organization?: ChromeOrganization;
  /** False on surfaces without a cover behind the bar, such as not-found. */
  overCover?: boolean;
}) {
  const scrolled = useCompactHeader();
  const compact = scrolled || !overCover;

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300 ease-out motion-reduce:transition-none",
        compact
          ? "border-b border-border/80 bg-background/90 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
      data-compact={compact ? "true" : "false"}
      data-testid="organization-chrome"
    >
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <BackButton
          fallbackHref={backHref}
          label={backLabel}
          tone={compact ? "solid" : "overlay"}
        />

        {organization ? (
          <div
            aria-hidden={!compact}
            className={cn(
              "flex min-w-0 items-center gap-2.5 transition-all duration-300 ease-out motion-reduce:transition-none",
              compact
                ? "flex-1 translate-y-0 opacity-100"
                : "pointer-events-none w-0 -translate-y-1 overflow-hidden opacity-0",
            )}
            data-compact={compact ? "true" : "false"}
            data-testid="organization-compact-identity"
          >
            <span className="hidden h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-kondo-lime text-[11px] font-black text-kondo-forest sm:grid">
              {organization.logoUrl ? (
                // The media endpoint enforces publication visibility itself.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="h-full w-full object-cover"
                  src={organization.logoUrl}
                />
              ) : (
                initials(organization.name)
              )}
            </span>
            <span className="min-w-0 truncate text-sm font-black tracking-tight text-kondo-ink dark:text-white">
              {organization.name}
            </span>
            {organization.verified ? (
              <OfficialMark
                organizationName={organization.name}
                organizationType={organization.type}
                size="sm"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function useCompactHeader() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setCompact(window.scrollY > COMPACT_HEADER_OFFSET);
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return compact;
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
