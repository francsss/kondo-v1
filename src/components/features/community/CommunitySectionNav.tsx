"use client";

import { Compass, MapPin, Sparkles, Users, Video } from "lucide-react";
import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

type CommunityTab = "my" | "discover" | "nearby" | "meet";
const SEEN_EVENT = "kondo:meet-seen";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(SEEN_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SEEN_EVENT, callback);
  };
}

export function CommunitySectionNav({
  activeTab,
  userId,
}: {
  activeTab: CommunityTab;
  userId: string;
}) {
  const storageKey = `kondo:meet-seen:${userId}`;
  const meetSeen = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(storageKey) === "1",
    () => true,
  );

  useEffect(() => {
    if (activeTab !== "meet" || meetSeen) return;
    window.localStorage.setItem(storageKey, "1");
    window.dispatchEvent(new Event(SEEN_EVENT));
  }, [activeTab, meetSeen, storageKey]);

  const tabs = [
    {
      value: "my" as const,
      label: "My Community",
      icon: Users,
      href: "/communities",
    },
    {
      value: "discover" as const,
      label: "Discover",
      icon: Compass,
      href: "/communities?tab=discover",
    },
    {
      value: "nearby" as const,
      label: "Nearby",
      icon: MapPin,
      href: "/communities?tab=nearby",
    },
    {
      value: "meet" as const,
      label: "Meet",
      icon: Video,
      href: "/communities?tab=meet",
    },
  ];

  /*
   * A fourth tab does not fit four equal columns on a 390px phone — the labels
   * truncated to "My Co…" and "Disco…", and Meet lost its label entirely.
   * `subnav-row` is the pattern already used for Meet's own modes: every tab
   * keeps its full label and the row scrolls if it has to.
   */
  return (
    <nav
      aria-label="Community sections"
      className="subnav-row mt-8 border-b border-border"
    >
      {tabs.map(({ value, label, icon: Icon, href }) => (
        <Link
          aria-current={activeTab === value ? "page" : undefined}
          className={cn(
            "relative flex min-h-14 min-w-0 items-center justify-center gap-1.5 px-1 text-xs transition duration-200 sm:gap-2 sm:px-3 sm:text-sm",
            activeTab === value
              ? "font-black text-kondo-green after:absolute after:inset-x-[18%] after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-kondo-green"
              : "font-bold text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
          href={href}
          key={value}
          scroll={false}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 truncate">{label}</span>
          {value === "meet" && !meetSeen && activeTab !== "meet" ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-kondo-green/25 bg-kondo-mint px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-kondo-green shadow-[0_0_0_0_rgba(22,163,106,0.28)] animate-[pulse_2.4s_ease-in-out_infinite] dark:bg-emerald-400/10">
              <Sparkles className="h-2.5 w-2.5" />
              <span className="hidden min-[390px]:inline">New</span>
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
