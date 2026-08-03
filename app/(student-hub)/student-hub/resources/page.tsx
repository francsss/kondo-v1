import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpenText,
  Clapperboard,
  Compass,
  House,
  Users,
  type LucideIcon,
} from "lucide-react";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Resources — Student Hub",
  description:
    "Trusted Kondo guides and student-life resources for studying in China.",
};

type ResourceDestination = {
  description: string;
  href: string;
  icon: LucideIcon;
  label: string;
};

export default async function StudentHubResourcesPage() {
  const user = await requireUser();
  const cityHref = user.city?.slug
    ? `/discover/cities/${user.city.slug}`
    : "/discover";
  const destinations: readonly ResourceDestination[] = [
    {
      label: "Guides",
      description:
        "Practical, reviewed guidance for university procedures and everyday student life.",
      href: "/guides",
      icon: BookOpenText,
    },
    {
      label: "Student Stories",
      description:
        "Real experiences from students navigating campuses, cities and life in China.",
      href: "/stories",
      icon: Clapperboard,
    },
    {
      label: "Communities",
      description:
        "Ask questions and learn from students who share your city, university or background.",
      href: "/communities",
      icon: Users,
    },
    {
      label: "Housing resources",
      description:
        "Browse housing, roommate options and the guidance that helps you choose safely.",
      href: "/housing",
      icon: House,
    },
    {
      label: user.city ? `${user.city.name} city resources` : "City resources",
      description:
        "Find useful places, services and local knowledge for your life beyond campus.",
      href: cityHref,
      icon: Compass,
    },
  ];

  return (
    <div className="mx-auto max-w-[1080px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-kondo-green">
          Student Hub · Resources
        </p>
        <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-[-0.04em] sm:text-4xl">
          Trusted support for study and student life.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          Move directly into the Kondo spaces that can help with your studies,
          your campus life and your city.
        </p>
      </header>

      <nav
        aria-label="Student resources"
        className="mt-8 divide-y divide-border border-y border-border"
      >
        {destinations.map((destination) => {
          const Icon = destination.icon;
          return (
            <Link
              className="group grid min-h-24 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-5 outline-none transition-colors hover:text-kondo-green focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background sm:gap-5 sm:px-2"
              href={destination.href}
              key={destination.label}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-kondo-mint text-kondo-forest transition-colors group-hover:bg-kondo-green group-hover:text-white dark:bg-emerald-400/10 dark:text-emerald-200">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-black tracking-[-0.015em] text-foreground">
                  {destination.label}
                </span>
                <span className="mt-1 block max-w-2xl text-sm leading-6 text-muted-foreground">
                  {destination.description}
                </span>
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-kondo-green motion-reduce:transform-none motion-reduce:transition-none"
              />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
