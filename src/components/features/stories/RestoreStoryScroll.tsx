"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function RestoreStoryScroll() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    const origin = `${pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    const key = `kondo-scroll:${origin}`;
    const saved = window.sessionStorage.getItem(key);
    if (!saved) return;
    window.sessionStorage.removeItem(key);
    const top = Number(saved);
    if (!Number.isFinite(top)) return;
    window.requestAnimationFrame(() =>
      window.scrollTo({ top, behavior: "auto" }),
    );
  }, [pathname, search]);
  return null;
}
