import Link from "next/link";
import { cn } from "@/lib/utils";

type KondoLogoProps = {
  className?: string;
  compactOnMobile?: boolean;
  href?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
};

const sizeClasses = {
  sm: {
    link: "h-9",
    mark: "h-8 w-8 rounded-[10px] text-sm",
    text: "text-xl leading-none",
  },
  md: {
    link: "h-11",
    mark: "h-10 w-10 rounded-xl text-base",
    text: "text-2xl leading-none",
  },
  lg: {
    link: "h-16",
    mark: "h-14 w-14 rounded-2xl text-xl",
    text: "text-4xl leading-none",
  },
};

export function KondoLogo({
  className,
  compactOnMobile = false,
  href = "/",
  size = "md",
  showTagline = false,
}: KondoLogoProps) {
  const classes = sizeClasses[size];
  const content = (
    <div className="flex h-full shrink-0 items-center gap-3 whitespace-nowrap">
      <span
        aria-hidden="true"
        className={cn(
          "grid shrink-0 place-items-center bg-primary font-black leading-none text-primary-foreground shadow-[0_8px_22px_rgba(16,163,109,0.22)]",
          classes.mark,
        )}
      >
        K
      </span>
      <div className={cn("leading-none", compactOnMobile && "hidden sm:block")}>
        <div
          className={`${classes.text} font-black tracking-[-0.04em] text-kondo-ink dark:text-white`}
        >
          Kondo
        </div>
        {showTagline ? (
          <div className="text-xs font-semibold tracking-wide text-kondo-forest dark:text-emerald-300">
            Find your people. Find your way.
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <Link
      aria-label="Kondo home"
      className={cn(
        "inline-flex shrink-0 items-center align-middle",
        classes.link,
        className,
      )}
      href={href}
    >
      {content}
    </Link>
  );
}
