"use client";

import { useCallback, useEffect, useState } from "react";

const FOCUS_CLASS = "kondo-focus";

/**
 * Focus Mode: hide Kondo's chrome so the academic content owns the screen.
 *
 * This is a style change, not a navigation. Toggling adds one class to
 * `<html>`; the route, the component tree, the fetched data, the scroll offset
 * and the reading position are all untouched, so entering and leaving are
 * effectively instant and nothing reloads.
 *
 * Native fullscreen rides along as an enhancement where the browser offers it.
 * It is never required — iOS Safari on iPhone exposes no Fullscreen API, and
 * Focus Mode has to work there too — so a rejected or missing request is
 * ignored rather than treated as a failure.
 */
export function useFocusMode() {
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(FOCUS_CLASS, focused);
    return () => root.classList.remove(FOCUS_CLASS);
  }, [focused]);

  // Leaving fullscreen by Escape or a system gesture must also leave Focus
  // Mode, or the chrome stays hidden with no visible way back.
  useEffect(() => {
    function onFullscreenChange() {
      if (!document.fullscreenElement)
        setFocused((current) => current && false);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!focused) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFocused(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focused]);

  const toggle = useCallback(() => {
    setFocused((current) => {
      const next = !current;
      const root = document.documentElement;
      if (next) {
        // Feature-detected, and failure is silent: Focus Mode already works
        // without it.
        root.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {});
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      return next;
    });
  }, []);

  return { focused, toggle };
}
