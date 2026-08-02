"use client";

import { useEffect } from "react";

/**
 * Exposes the usable visual viewport without translating the document.
 * Mobile Safari changes this viewport while the keyboard opens; consumers can
 * size full-screen dialogs against the variable without making fixed headers
 * jump or forcing horizontal reflow.
 */
export function MobileViewportStabilizer() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;

    function update() {
      root.style.setProperty(
        "--visual-viewport-height",
        `${Math.round(viewport?.height ?? window.innerHeight)}px`,
      );
      root.style.setProperty(
        "--visual-viewport-offset-top",
        `${Math.round(viewport?.offsetTop ?? 0)}px`,
      );
    }

    update();
    // `interactive-widget=resizes-content` resizes the layout viewport, which
    // does not always emit a visualViewport event. Listening to both keeps the
    // variable from going stale and leaving a fixed shell taller than the
    // screen — which would push the message composer out of view.
    window.addEventListener("resize", update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);

    return () => {
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
      root.style.removeProperty("--visual-viewport-height");
      root.style.removeProperty("--visual-viewport-offset-top");
    };
  }, []);

  return null;
}
