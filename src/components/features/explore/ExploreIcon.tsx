import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  Building2,
  BusFront,
  GraduationCap,
  Landmark,
  PartyPopper,
  ShoppingBag,
} from "lucide-react";
import type {
  ExploreAccent,
  ExploreIconName,
} from "@/features/explore/types";

const icons: Record<ExploreIconName, LucideIcon> = {
  companies: Building2,
  products: ShoppingBag,
  universities: GraduationCap,
  jobs: BriefcaseBusiness,
  events: PartyPopper,
  services: BusFront,
  about: Landmark,
};

export const exploreAccentStyles: Record<
  ExploreAccent,
  {
    icon: string;
    gradient: string;
    glow: string;
    label: string;
  }
> = {
  emerald: {
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
    gradient: "from-emerald-500 via-emerald-600 to-teal-800",
    glow: "bg-emerald-300/25",
    label: "text-emerald-700 dark:text-emerald-300",
  },
  amber: {
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    gradient: "from-amber-400 via-orange-500 to-amber-800",
    glow: "bg-amber-300/30",
    label: "text-amber-700 dark:text-amber-300",
  },
  blue: {
    icon: "bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
    gradient: "from-blue-500 via-blue-600 to-indigo-800",
    glow: "bg-blue-300/25",
    label: "text-blue-700 dark:text-blue-300",
  },
  violet: {
    icon: "bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
    gradient: "from-violet-500 via-purple-600 to-indigo-900",
    glow: "bg-violet-300/25",
    label: "text-violet-700 dark:text-violet-300",
  },
  rose: {
    icon: "bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
    gradient: "from-rose-500 via-pink-600 to-red-900",
    glow: "bg-rose-300/25",
    label: "text-rose-700 dark:text-rose-300",
  },
  cyan: {
    icon: "bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300",
    gradient: "from-cyan-500 via-teal-600 to-emerald-900",
    glow: "bg-cyan-300/25",
    label: "text-cyan-700 dark:text-cyan-300",
  },
  slate: {
    icon: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200",
    gradient: "from-slate-600 via-slate-700 to-slate-950",
    glow: "bg-white/15",
    label: "text-slate-600 dark:text-slate-300",
  },
};

export function ExploreIcon({
  name,
  className = "h-5 w-5",
}: {
  name: ExploreIconName;
  className?: string;
}) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" className={className} />;
}
