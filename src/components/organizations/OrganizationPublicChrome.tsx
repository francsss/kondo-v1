import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";

export function OrganizationPublicChrome({
  backHref,
  backLabel = "All organizations",
}: {
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          aria-label="Kondo home"
          className="inline-flex items-center gap-2 font-black tracking-tight text-kondo-ink dark:text-white"
          href="/"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-kondo-forest text-kondo-lime">
            K
          </span>
          <span>Kondo</span>
        </Link>
        {backHref ? (
          <Link
            aria-label={backLabel}
            className="ml-1 inline-flex h-9 w-9 items-center justify-center gap-1.5 rounded-full text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-kondo-green sm:ml-2 sm:h-auto sm:w-auto sm:justify-start sm:rounded-none"
            href={backHref}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{backLabel}</span>
          </Link>
        ) : null}
        <nav
          aria-label="Public organization navigation"
          className="ml-auto flex items-center gap-2"
        >
          <Link
            className="hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-muted-foreground transition hover:bg-muted sm:inline-flex"
            href="/organizations"
          >
            <Building2 className="h-4 w-4" />
            Organizations
          </Link>
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
        </nav>
      </div>
    </header>
  );
}
