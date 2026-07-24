"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  EllipsisVertical,
  Clapperboard,
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
  {
    href: "/stories",
    label: "Student Stories",
    description: "Useful videos from student life in China",
    icon: Clapperboard,
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
          "rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground sm:w-auto sm:px-3",
          (open || pathname.startsWith("/explore")) &&
            "bg-primary text-primary-foreground",
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
          className="absolute right-0 top-12 z-50 w-[min(88vw,340px)] origin-top-right rounded-3xl border border-border bg-card/95 p-2 text-card-foreground shadow-[0_24px_80px_rgba(16,24,40,0.2)] backdrop-blur-xl"
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
                    active ? "bg-secondary" : "hover:bg-muted",
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
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-card-foreground">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-kondo-green">
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
