"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A mobile-native surface for the controls that used to sit permanently on
 * top of the products.
 *
 * It rises from the bottom on a phone, where the thumb is, and becomes a
 * centred dialog once there is room. Sized against `--visual-viewport-height`
 * so an open keyboard shrinks the sheet instead of pushing its footer off the
 * screen — the same variable `MobileViewportStabilizer` publishes for the
 * search overlay.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() =>
      panelRef.current?.focus({ preventScroll: true }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        aria-label={`Close ${title}`}
        className="absolute inset-0 bg-overlay/50 backdrop-blur-sm"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-label={title}
        aria-modal="true"
        className={cn(
          "animate-sheet-in relative flex max-h-[min(85vh,var(--visual-viewport-height,85vh))] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-card text-card-foreground shadow-[0_-12px_48px_rgba(16,24,40,0.22)] outline-none",
          "sm:max-w-lg sm:rounded-3xl sm:shadow-[0_24px_64px_rgba(16,24,40,0.24)]",
          "motion-reduce:animate-none",
        )}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-black text-foreground">{title}</h2>
          <button
            aria-label={`Close ${title}`}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>
        {footer ? (
          <div className="safe-bottom shrink-0 border-t border-border px-4 pt-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
