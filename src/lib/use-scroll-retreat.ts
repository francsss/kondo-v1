"use client";

import { useEffect, useRef, useState } from "react";

/**
 * True while the reader is scrolling forward through a chapter.
 *
 * Reading controls earn their space only when they are wanted. Scrolling down
 * is the clearest signal a student is reading rather than navigating, so the
 * chrome retreats; scrolling back up, or reaching the top, is the signal to
 * bring it back. Nothing is unmounted — the controls only stop being drawn, so
 * the layout never reflows under the text being read.
 *
 * Small movements are ignored: a touch scroll that wobbles a few pixels either
 * way must not flicker the header. Reads are batched into one animation frame,
 * so a fast flick does no work per scroll event.
 */
export function useScrollRetreat({
  threshold = 120,
  delta = 8,
}: { threshold?: number; delta?: number } = {}) {
  const [retreated, setRetreated] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    let frame = 0;

    function measure() {
      frame = 0;
      const y = window.scrollY;
      const moved = y - lastY.current;
      if (Math.abs(moved) < delta) return;
      lastY.current = y;
      // Above the threshold there is nothing to gain by hiding, and hiding
      // there would leave a reader at the top of a chapter with no controls.
      setRetreated(y > threshold && moved > 0);
    }

    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [delta, threshold]);

  return retreated;
}
