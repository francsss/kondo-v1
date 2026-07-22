"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BookOpenText,
  CircleHelp,
  GraduationCap,
  Sparkles,
  Wrench,
} from "lucide-react";
import { ThemeToggle } from "@/components/app/AppShell";

const tabs = [
  { href: "/student-hub", label: "Guide", icon: BookOpenText },
  { href: "/student-hub/tools", label: "My Tools", icon: Wrench },
  {
    href: "/student-hub/scholarships",
    label: "Scholarships",
    icon: GraduationCap,
  },
  { href: "/student-hub/help", label: "Help", icon: CircleHelp },
] as const;

export function StudentHubShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { firstName: string; lastName: string };
}) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-[#f7faf8] text-kondo-ink dark:bg-[#07110e] dark:text-white">
      <header className="sticky top-0 z-50 border-b border-emerald-950/8 bg-[#f7faf8]/90 backdrop-blur-xl dark:border-white/8 dark:bg-[#07110e]/88">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            className="flex items-center gap-2.5 font-black tracking-tight"
            href="/student-hub"
          >
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-kondo-ink text-kondo-lime dark:bg-emerald-400 dark:text-kondo-ink">
              <Sparkles className="h-4 w-4" />
            </span>
            <span>
              Kondo <span className="text-kondo-green">Student</span>
            </span>
          </Link>
          <nav
            aria-label="Student Hub"
            className="scrollbar-none ml-auto hidden items-center gap-1 overflow-x-auto md:flex"
          >
            {tabs.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/student-hub"
                  ? pathname === href ||
                    pathname.startsWith("/student-hub/guide/")
                  : pathname.startsWith(href);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "inline-flex h-10 items-center gap-2 rounded-full bg-kondo-ink px-4 text-sm font-black text-white dark:bg-emerald-400 dark:text-kondo-ink"
                      : "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold text-muted-foreground transition hover:bg-white hover:text-kondo-ink dark:hover:bg-white/5 dark:hover:text-white"
                  }
                  href={href}
                  key={href}
                >
                  <Icon className="h-4 w-4" /> {label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-2">
            <ThemeToggle />
            <span className="hidden text-xs font-bold text-muted-foreground lg:inline">
              {user.firstName}
            </span>
            <Link
              aria-label="Back to Kondo"
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card transition hover:border-kondo-green"
              href="/home"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <nav
          aria-label="Student Hub mobile"
          className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-3 md:hidden"
        >
          {tabs.map(({ href, label }) => {
            const active =
              href === "/student-hub"
                ? pathname === href ||
                  pathname.startsWith("/student-hub/guide/")
                : pathname.startsWith(href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "whitespace-nowrap rounded-full bg-kondo-ink px-4 py-2 text-xs font-black text-white dark:bg-emerald-400 dark:text-kondo-ink"
                    : "whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-muted-foreground"
                }
                href={href}
                key={href}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
