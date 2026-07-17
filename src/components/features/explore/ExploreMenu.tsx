"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  EllipsisVertical,
  Languages,
  MapPinned,
  Megaphone,
  Settings,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const menuItems = [
  {
    href: "/explore/jiaxing",
    label: "Explore Jiaxing",
    description: "Companies, city life, and opportunity",
    icon: MapPinned,
    featured: true,
  },
  {
    href: "/explore/jiaxing/events",
    label: "City Events",
    description: "Fairs, competitions, and culture",
    icon: Megaphone,
    featured: false,
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Your Kondo preferences",
    icon: Settings,
    featured: false,
  },
  {
    href: "/language",
    label: "Language",
    description: "Language and localization",
    icon: Languages,
    featured: false,
  },
] as const;

export function ExploreMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePress(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open Explore menu"
        className={cn(
          "rounded-full bg-kondo-ink text-white shadow-sm hover:bg-kondo-forest hover:text-white dark:bg-emerald-400 dark:text-kondo-ink dark:hover:bg-emerald-300 sm:w-auto sm:px-3",
          (open || pathname.startsWith("/explore")) &&
            "bg-kondo-green text-white dark:bg-emerald-300 dark:text-kondo-ink",
        )}
        onClick={() => setOpen((value) => !value)}
        size="icon"
        title="Explore Jiaxing and city services"
        type="button"
        variant="ghost"
      >
        <EllipsisVertical aria-hidden="true" className="h-5 w-5" />
        <span className="hidden sm:inline">Explore</span>
      </Button>

      {open ? (
        <div
          className="absolute right-0 top-12 z-50 w-[min(88vw,340px)] origin-top-right rounded-3xl border border-slate-200/80 bg-white/95 p-2 shadow-[0_24px_80px_rgba(16,24,40,0.2)] backdrop-blur-xl dark:border-white/10 dark:bg-[#14201d]/95"
          role="menu"
        >
          <div className="rounded-2xl bg-gradient-to-br from-kondo-navy to-kondo-forest px-4 py-3.5 text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-kondo-lime">
              Discover nearby
            </p>
            <p className="mt-1 text-sm font-bold">
              Your city is part of student life.
            </p>
          </div>
          <div className="mt-1 space-y-0.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-2xl px-3 py-3 transition",
                    active
                      ? "bg-kondo-mint dark:bg-emerald-400/10"
                      : "hover:bg-slate-50 dark:hover:bg-white/5",
                  )}
                  href={item.href}
                  key={item.href}
                  onClick={() => setOpen(false)}
                  role="menuitem"
                >
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-2xl",
                      item.featured
                        ? "bg-kondo-lime text-kondo-forest"
                        : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300",
                    )}
                  >
                    <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-kondo-ink dark:text-white">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                      {item.description}
                    </span>
                  </span>
                  <span className="text-sm text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-kondo-green">
                    →
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
