"use client";

import { useEffect } from "react";

/**
 * Keep the field you are typing in above the software keyboard.
 *
 * Browsers scroll a focused input into view when the keyboard opens, but they
 * measure against the layout viewport, not the visible one — so a field low in
 * a long form stays exactly where it was, behind the keys. Measured on the
 * product form with a keyboard occupying the bottom 336px: the focused field
 * sat at y=576 while the visible area ended at y=508.
 *
 * This watches the visual viewport instead. When it shrinks — which is what a
 * keyboard opening actually is — the focused field is checked against the area
 * that remains, and only scrolled if it is genuinely hidden. A field already in
 * view is left alone, so nothing jumps for the sake of it.
 */

/** Breathing room so the field does not sit flush against the keyboard. */
const MARGIN = 16;

export function useKeyboardAwareFocus() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    function ensureFocusedFieldVisible() {
      const active = document.activeElement as HTMLElement | null;
      if (!active) return;
      const tag = active.tagName.toLowerCase();
      if (tag !== "input" && tag !== "textarea" && tag !== "select") return;

      const box = active.getBoundingClientRect();
      const visibleTop = viewport!.offsetTop ?? 0;
      const visibleBottom = visibleTop + viewport!.height;
      // Only act when the field is actually occluded, or pushed off the top.
      if (box.bottom <= visibleBottom - MARGIN && box.top >= visibleTop) return;

      /*
       * The scroll is computed here rather than handed to `scrollIntoView`.
       *
       * That API positions against the layout viewport, which is exactly the
       * one the keyboard does not shrink: asked to centre a 222px description
       * box it produced top=311 in an 844px layout, leaving the bottom at 533
       * with the keys starting at 508. Correct by its own measure, useless by
       * the only measure that matters.
       *
       * So the delta is measured against the visible area instead. A field
       * taller than that area is aligned by its top, where the caret is;
       * everything else is brought just clear of the keyboard.
       */
      const usable = viewport!.height - MARGIN * 2;
      const delta =
        box.height > usable
          ? box.top - (visibleTop + MARGIN)
          : box.bottom - (visibleBottom - MARGIN);
      if (Math.abs(delta) < 1) return;
      // Instant, not smooth: the keyboard arrives at once and an animation
      // chasing it reads as lag.
      window.scrollBy({ top: delta, behavior: "auto" });
    }

    // The resize is the keyboard; the delay lets the browser finish its own
    // scroll attempt first so the two do not fight.
    let timer: number | undefined;
    function onResize() {
      window.clearTimeout(timer);
      timer = window.setTimeout(ensureFocusedFieldVisible, 120);
    }

    viewport.addEventListener("resize", onResize);
    document.addEventListener("focusin", onResize);
    return () => {
      window.clearTimeout(timer);
      viewport.removeEventListener("resize", onResize);
      document.removeEventListener("focusin", onResize);
    };
  }, []);
}
