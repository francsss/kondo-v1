"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { OfficialMark } from "@/components/features/official-profile/OfficialMark";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

type ChromeOrganization = {
  name: string;
  logoUrl: string | null;
  verified: boolean;
  type: string;
};

type SessionUser = {
  firstName: string;
  lastName: string;
  avatarMediaId: string | null;
};

type SessionState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "member"; user: SessionUser };

/** The compact header takes over once the hero has scrolled out of reach. */
const COMPACT_HEADER_OFFSET = 220;

/**
 * The chrome for a public organization page. It deliberately carries no main
 * platform navigation: the organization is the subject of the page. The
 * account area resolves from the session so a signed-in member is never
 * offered "Log in" on a page they are already authenticated for, while the
 * route itself stays cacheable for anonymous visitors and crawlers.
 */
export function OrganizationPublicChrome({
  backHref,
  backLabel = "All organizations",
  organization,
}: {
  backHref?: string;
  backLabel?: string;
  organization?: ChromeOrganization;
}) {
  const session = useSessionUser();
  const compact = useCompactHeader(Boolean(organization));

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          aria-label="Kondo home"
          className="inline-flex shrink-0 items-center gap-2 font-black tracking-tight text-kondo-ink dark:text-white"
          href="/"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-kondo-forest text-kondo-lime">
            K
          </span>
          <span className={cn(compact && "hidden sm:inline")}>Kondo</span>
        </Link>

        {backHref ? (
          <Link
            aria-label={backLabel}
            className={cn(
              "h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-kondo-green sm:inline-flex sm:h-auto sm:w-auto sm:justify-start sm:rounded-none",
              // On a phone the compact bar belongs to the organization; the
              // Kondo mark already leads back out.
              compact ? "hidden" : "inline-flex",
            )}
            href={backHref}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className={cn("hidden", !compact && "sm:inline")}>
              {backLabel}
            </span>
          </Link>
        ) : null}

        {organization ? (
          <div
            aria-hidden={!compact}
            data-compact={compact ? "true" : "false"}
            data-testid="organization-compact-identity"
            className={cn(
              "flex min-w-0 items-center gap-2.5 transition-all duration-300 ease-out motion-reduce:transition-none",
              compact
                ? "flex-1 translate-y-0 opacity-100"
                : "pointer-events-none w-0 -translate-y-1 overflow-hidden opacity-0",
            )}
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

        <nav
          aria-label="Kondo account"
          className="ml-auto flex shrink-0 items-center gap-2"
        >
          {session.status === "loading" ? (
            <span
              aria-hidden="true"
              className="h-9 w-24 animate-pulse rounded-full bg-muted"
            />
          ) : session.status === "member" ? (
            <Link
              aria-label="Back to Kondo"
              className="inline-flex items-center gap-2 rounded-full border-border p-0.5 text-sm font-black transition hover:border-kondo-green hover:text-kondo-green sm:border sm:py-1 sm:pl-1 sm:pr-4"
              href="/home"
            >
              <Avatar
                className="h-8 w-8 sm:h-7 sm:w-7"
                firstName={session.user.firstName}
                lastName={session.user.lastName}
                mediaId={session.user.avatarMediaId}
              />
              <span className="hidden sm:inline">Back to Kondo</span>
            </Link>
          ) : (
            <>
              <Link
                className="rounded-full border border-border px-4 py-2 text-sm font-black transition hover:border-kondo-green hover:text-kondo-green"
                href="/login"
              >
                Log in
              </Link>
              <Link
                className="rounded-full bg-kondo-forest px-4 py-2 text-sm font-black text-white transition hover:bg-kondo-green"
                href="/register"
              >
                Join Kondo
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

/**
 * Resolves the viewer from the session endpoint rather than from the page,
 * which keeps the public organization route statically cacheable. Nothing is
 * rendered in the account slot until the answer is known, so a signed-in
 * member never sees a flash of "Log in".
 */
function useSessionUser(): SessionState {
  const [session, setSession] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/me", {
      credentials: "include",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        setSession(
          data?.user
            ? {
                status: "member",
                user: {
                  firstName: data.user.firstName,
                  lastName: data.user.lastName,
                  avatarMediaId: data.user.avatarMediaId ?? null,
                },
              }
            : { status: "guest" },
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setSession({ status: "guest" });
      });
    return () => controller.abort();
  }, []);

  return session;
}

function useCompactHeader(enabled: boolean) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled]);

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
