import Link from "next/link";
import { cn } from "@/lib/utils";

type KondoLogoProps = {
  href?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
};

const sizeClasses = {
  sm: { mark: "h-8 w-8 rounded-[10px] text-sm", text: "text-xl" },
  md: { mark: "h-10 w-10 rounded-xl text-base", text: "text-2xl" },
  lg: { mark: "h-14 w-14 rounded-2xl text-xl", text: "text-4xl" },
};

export function KondoLogo({
  href = "/",
  size = "md",
  showTagline = false,
}: KondoLogoProps) {
  const classes = sizeClasses[size];
  const content = (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={cn(
          "grid place-items-center bg-gradient-to-br from-kondo-green to-kondo-forest font-black text-white shadow-[0_8px_22px_rgba(16,163,109,0.22)]",
          classes.mark,
        )}
      >
        K
      </span>
      <div>
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
    <Link aria-label="Kondo home" href={href} className="inline-flex">
      {content}
    </Link>
  );
}
