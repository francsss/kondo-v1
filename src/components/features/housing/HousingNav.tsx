import Link from "next/link";
import {
  Bookmark,
  Building2,
  Map,
  MessageSquareText,
  Search,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/housing", label: "Discover", icon: Building2 },
  { href: "/housing/search", label: "Search", icon: Search },
  { href: "/housing/map", label: "Map", icon: Map },
  { href: "/housing/roommates", label: "Roommates", icon: Users },
  { href: "/housing/requests", label: "Requests", icon: MessageSquareText },
  { href: "/housing/saved", label: "Saved", icon: Bookmark },
] as const;

export function HousingNav({ active }: { active: string }) {
  return (
    <nav
      aria-label="Housing sections"
      className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto pb-2"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            aria-current={active === item.href ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition",
              active === item.href
                ? "bg-foreground text-background shadow-sm"
                : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            href={item.href}
            key={item.href}
            scroll={false}
          >
            <Icon aria-hidden className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
