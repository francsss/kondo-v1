"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { useFocusMode } from "@/lib/use-focus-mode";

/**
 * The Focus Mode control for screens that are otherwise server-rendered.
 *
 * A one-button client island: the page around it stays a server component, so
 * entering focus costs a class on `<html>` and nothing else — no navigation,
 * no refetch, no lost scroll position.
 */
export function FocusToggle({ label }: { label: string }) {
  const { focused, toggle } = useFocusMode();
  return (
    <button
      aria-label={focused ? `Leave Focus Mode` : `Focus on ${label}`}
      aria-pressed={focused}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
      onClick={toggle}
      title={focused ? "Leave Focus Mode (Esc)" : "Focus Mode"}
      type="button"
    >
      {focused ? (
        <Minimize2 aria-hidden="true" className="h-4 w-4" />
      ) : (
        <Maximize2 aria-hidden="true" className="h-4 w-4" />
      )}
    </button>
  );
}
