"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarDays, Flag, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { cn } from "@/lib/utils";

type OfficialMarkProps = {
  organizationType?: string | null;
  organizationName?: string | null;
  verifiedAt?: string | Date | null;
  size?: "sm" | "md";
  withLabel?: boolean;
  className?: string;
};

function readableType(value?: string | null) {
  if (!value) return "organization";
  return value.toLowerCase().replaceAll("_", " ");
}

export function OfficialMark({
  organizationType,
  organizationName,
  verifiedAt,
  size = "sm",
  withLabel = false,
  className,
}: OfficialMarkProps) {
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    function close(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  function showInformation() {
    setOpen(true);
    captureProductEvent(PRODUCT_EVENTS.OFFICIAL_MARK_CLICKED, {
      organization_type: organizationType,
      surface: size,
    });
    captureProductEvent(PRODUCT_EVENTS.VERIFICATION_INFO_OPENED, {
      organization_type: organizationType,
    });
  }

  return (
    <>
      <button
        aria-haspopup="dialog"
        aria-label="Official profile. Open verification information."
        className={cn(
          "inline-flex min-h-6 items-center gap-1.5 rounded-full align-middle text-kondo-forest outline-none transition hover:bg-kondo-mint focus-visible:ring-2 focus-visible:ring-kondo-green focus-visible:ring-offset-2 dark:text-emerald-300",
          withLabel &&
            "border border-emerald-200 bg-kondo-mint/70 px-2 py-1 dark:border-emerald-400/20 dark:bg-emerald-400/10",
          className,
        )}
        onClick={showInformation}
        title="Official profile recognized by Kondo"
        type="button"
      >
        <span
          aria-hidden="true"
          className={cn(
            "relative inline-grid shrink-0 rotate-45 place-items-center rounded-[4px] border border-kondo-green/30 bg-gradient-to-br from-kondo-lime to-emerald-300 shadow-[0_2px_8px_rgba(12,90,68,0.18)]",
            size === "sm" ? "h-[17px] w-[17px]" : "h-5 w-5",
          )}
        >
          <span
            className={cn(
              "-rotate-45 font-black leading-none text-kondo-forest",
              size === "sm" ? "text-[8px]" : "text-[9px]",
            )}
          >
            K
          </span>
        </span>
        {withLabel ? (
          <span className="text-[10px] font-black uppercase tracking-[0.08em]">
            Official profile
          </span>
        ) : (
          <span className="sr-only">Official profile</span>
        )}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] grid place-items-center bg-overlay/55 p-4 backdrop-blur-sm"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            role="presentation"
            transition={{ duration: reducedMotion ? 0 : 0.16 }}
          >
            <motion.section
              aria-labelledby="official-profile-title"
              aria-modal="true"
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-md rounded-[2rem] border border-border bg-card p-6 text-card-foreground shadow-2xl"
              exit={{ opacity: 0, scale: 0.98, y: 6 }}
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              transition={{ duration: reducedMotion ? 0 : 0.2 }}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300">
                  <ShieldCheck aria-hidden="true" className="h-6 w-6" />
                </span>
                <Button
                  aria-label="Close verification information"
                  onClick={() => setOpen(false)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
              <h2
                className="mt-5 text-2xl font-black tracking-tight text-kondo-ink dark:text-white"
                id="official-profile-title"
              >
                Official profile
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Kondo has confirmed that this profile officially represents{" "}
                {organizationName
                  ? `${organizationName}, a ${readableType(organizationType)}`
                  : `this ${readableType(organizationType)}`}
                .
              </p>
              <p className="mt-3 rounded-2xl bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
                This recognition confirms the represented identity. It is not an
                absolute guarantee of every statement or external service.
              </p>
              {verifiedAt ? (
                <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <CalendarDays aria-hidden="true" className="h-4 w-4" />
                  Reviewed by Kondo{" "}
                  {new Intl.DateTimeFormat("en", {
                    month: "long",
                    year: "numeric",
                  }).format(new Date(verifiedAt))}
                </p>
              ) : null}
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <a
                  className="text-xs font-black text-kondo-green hover:underline"
                  href="/guidelines"
                >
                  Safety information
                </a>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <Flag aria-hidden="true" className="h-3.5 w-3.5" />
                  Report concerns from the profile
                </span>
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
