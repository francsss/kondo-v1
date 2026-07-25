"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion, useReducedMotion } from "framer-motion";
import {
  Bell,
  Clapperboard,
  Compass,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Search,
  Settings,
  ShoppingBag,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";
import { ProductAnalyticsIdentity } from "@/components/analytics/ProductAnalytics";
import { PresenceHeartbeat } from "@/components/app/PresenceHeartbeat";
import { ExploreMenu } from "@/components/features/explore/ExploreMenu";
import { KondoPet } from "@/components/features/feedback/KondoPet";
import { RestoreStoryScroll } from "@/components/features/stories/RestoreStoryScroll";
import { KondoLogo } from "@/components/KondoLogo";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { canAccessAdmin } from "@/lib/authorization";
import { usesImmersiveAppShell } from "@/lib/app-shell";
import { resetProductAnalytics } from "@/lib/product-analytics-client";
import { cn } from "@/lib/utils";

type ShellUser = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  storyCreatorStatus?: string;
  officialProfileStatus?: string;
  avatarMediaId?: string | null;
  preference?: {
    theme: "LIGHT" | "DARK" | "SYSTEM";
    language: "ENGLISH" | "FRENCH" | "CHINESE" | "ARABIC";
  } | null;
  notificationUnreadCount?: number;
  messageUnreadCount?: number;
  country?: { code: string; name: string; emoji: string | null } | null;
  city?: { slug: string; name: string } | null;
  university?: {
    slug: string;
    shortName: string | null;
    name: string;
  } | null;
  onboardingCompletedAt?: Date | null;
};

type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  aliases?: readonly string[];
};

const navigation: NavigationItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/communities", label: "Communities", icon: Users },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  {
    href: "/student-hub",
    label: "Student Hub",
    icon: GraduationCap,
    aliases: ["/guides", "/help"],
  },
  { href: "/messages", label: "Messages", icon: MessageCircle },
];

const secondaryNavigation: NavigationItem[] = [
  { href: "/stories", label: "Student Stories", icon: Clapperboard },
];

const kondoPetEnabled = process.env.NEXT_PUBLIC_KONDO_PET_ENABLED !== "false";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const dark = mounted && resolvedTheme === "dark";

  async function toggleTheme() {
    if (!mounted || saving) return;
    const previousTheme = dark ? "dark" : "light";
    const nextTheme = dark ? "light" : "dark";

    // next-themes updates <html class="dark"> and localStorage immediately.
    // The account request runs afterwards and never blocks the visual toggle.
    setTheme(nextTheme);
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: nextTheme.toUpperCase() }),
      });
      if (!response.ok) setTheme(previousTheme);
    } catch {
      setTheme(previousTheme);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      className="rounded-full"
      disabled={!mounted || saving}
      onClick={toggleTheme}
      size="icon"
      type="button"
      variant="ghost"
    >
      {dark ? (
        <Sun aria-hidden="true" className="h-[18px] w-[18px]" />
      ) : (
        <Moon aria-hidden="true" className="h-[18px] w-[18px]" />
      )}
    </Button>
  );
}

function ThemePreferenceSync({
  preference,
}: {
  preference: "LIGHT" | "DARK" | "SYSTEM";
}) {
  const { setTheme } = useTheme();
  const setThemeRef = useRef(setTheme);

  useEffect(() => {
    setThemeRef.current = setTheme;
  }, [setTheme]);

  useEffect(() => {
    // Only react to a new server preference. Depending on `theme` here would
    // immediately undo an optimistic toggle while its PATCH request is saving.
    // next-themes can also replace setTheme when its context updates, so keep
    // the latest function in a ref without making that replacement a sync event.
    setThemeRef.current(preference.toLowerCase());
  }, [preference]);
  return null;
}

function NavLink({
  href,
  icon: Icon,
  label,
  aliases,
  pathname,
  onNavigate,
  badgeCount,
}: NavigationItem & {
  pathname: string;
  onNavigate?: () => void;
  badgeCount?: number;
}) {
  const active =
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    aliases?.some(
      (alias) => pathname === alias || pathname.startsWith(`${alias}/`),
    );

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition-colors",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      href={href}
      onClick={onNavigate}
    >
      <Icon
        aria-hidden="true"
        className="h-5 w-5"
        strokeWidth={active ? 2.4 : 2}
      />
      {label}
      {badgeCount ? (
        <span className="ml-auto rounded-full bg-warning px-2 py-0.5 text-[10px] font-black text-warning-foreground">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      ) : null}
    </Link>
  );
}

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: ShellUser;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = canAccessAdmin(user.role);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        router.push("/search");
      }
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  async function logout() {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => null);
    if (response?.ok) {
      resetProductAnalytics();
      window.location.assign("/login");
    }
  }

  if (usesImmersiveAppShell(pathname)) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <ThemePreferenceSync preference={user.preference?.theme ?? "SYSTEM"} />
        <PresenceHeartbeat />
        <ProductAnalyticsIdentity user={user} />
        <RestoreStoryScroll />
        {children}
        <KondoPet enabled={kondoPetEnabled} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ThemePreferenceSync preference={user.preference?.theme ?? "SYSTEM"} />
      <PresenceHeartbeat />
      <ProductAnalyticsIdentity user={user} />
      <RestoreStoryScroll />
      <KondoPet enabled={kondoPetEnabled} />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-border bg-card/90 px-4 py-6 backdrop-blur-xl lg:flex lg:flex-col">
        <div className="px-2">
          <KondoLogo href="/home" />
        </div>
        <nav aria-label="Primary navigation" className="mt-10 space-y-1">
          {navigation.map((item) => (
            <NavLink
              badgeCount={
                item.href === "/messages" ? user.messageUnreadCount : undefined
              }
              key={item.href}
              {...item}
              pathname={pathname}
            />
          ))}
        </nav>

        <div className="mt-auto space-y-2">
          {!user.onboardingCompletedAt ? (
            <div className="rounded-3xl bg-gradient-to-br from-kondo-navy to-kondo-forest p-4 text-white shadow-lift">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/12">
                <Compass aria-hidden="true" className="h-4 w-4" />
              </div>
              <p className="mt-3 text-sm font-bold">Make Kondo yours</p>
              <p className="mt-1 text-xs leading-5 text-white/65">
                Finish your profile for more relevant people, places, and
                guides.
              </p>
              <Link
                className="mt-3 inline-flex text-xs font-bold text-kondo-lime"
                href="/onboarding"
              >
                Complete profile →
              </Link>
            </div>
          ) : null}
          {isAdmin ? (
            <NavLink
              href="/admin"
              icon={Settings}
              label="Admin"
              pathname={pathname}
            />
          ) : null}
          <button
            className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={logout}
            type="button"
          >
            <LogOut className="h-5 w-5" /> Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1440px] items-center gap-3">
            <div className="flex items-center lg:hidden">
              <Button
                aria-expanded={menuOpen}
                aria-controls="mobile-navigation"
                aria-label="Open navigation"
                onClick={() => setMenuOpen(true)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Menu aria-hidden="true" className="h-5 w-5" />
              </Button>
            </div>
            <Link
              className="group mx-auto flex h-11 min-w-0 w-full max-w-xl items-center gap-3 rounded-full border border-border bg-card px-4 text-sm text-muted-foreground shadow-sm transition hover:border-primary/50 hover:shadow-md sm:mx-0"
              href="/search"
            >
              <Search
                aria-hidden="true"
                className="h-4 w-4 transition group-hover:text-kondo-green"
              />
              <span className="truncate">Search Kondo</span>
              <kbd className="ml-auto hidden rounded-lg border border-border bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground sm:inline">
                ⌘ K
              </kbd>
            </Link>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <ThemeToggle />
              <Button asChild className="relative" size="icon" variant="ghost">
                <Link
                  aria-label={`Notifications${
                    user.notificationUnreadCount
                      ? `, ${user.notificationUnreadCount} unread`
                      : ""
                  }`}
                  href="/notifications"
                >
                  <Bell aria-hidden="true" className="h-[18px] w-[18px]" />
                  {user.notificationUnreadCount ? (
                    <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-background bg-warning px-1 text-[9px] font-black leading-none text-warning-foreground">
                      {user.notificationUnreadCount > 99
                        ? "99+"
                        : user.notificationUnreadCount}
                    </span>
                  ) : null}
                </Link>
              </Button>
              <Link
                aria-label="Open profile"
                className="ml-1 rounded-full transition hover:scale-105"
                href="/profile"
              >
                <Avatar
                  className="h-9 w-9"
                  firstName={user.firstName}
                  lastName={user.lastName}
                  mediaId={user.avatarMediaId}
                />
              </Link>
              <ExploreMenu />
            </div>
          </div>
        </header>

        <motion.main
          animate={{ opacity: 1, y: 0 }}
          initial={reducedMotion ? false : { opacity: 0, y: 4 }}
          key={pathname}
          transition={{ duration: reducedMotion ? 0 : 0.18, ease: "easeOut" }}
        >
          {children}
        </motion.main>
      </div>

      <div
        aria-hidden={!menuOpen}
        className={cn(
          "fixed inset-0 z-50 bg-overlay/40 backdrop-blur-sm transition lg:hidden",
          menuOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={() => setMenuOpen(false)}
      >
        <aside
          aria-modal="true"
          aria-label="Mobile navigation"
          id="mobile-navigation"
          role="dialog"
          className={cn(
            "h-full w-[min(84vw,320px)] bg-card p-5 text-card-foreground shadow-2xl transition-transform duration-300",
            menuOpen ? "translate-x-0" : "-translate-x-full",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <KondoLogo href="/home" />
            <Button
              aria-label="Close navigation"
              onClick={() => setMenuOpen(false)}
              size="icon"
              variant="ghost"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </Button>
          </div>
          <nav className="mt-8 space-y-1">
            {navigation.map((item) => (
              <NavLink
                badgeCount={
                  item.href === "/messages"
                    ? user.messageUnreadCount
                    : undefined
                }
                key={item.href}
                {...item}
                pathname={pathname}
                onNavigate={() => setMenuOpen(false)}
              />
            ))}
            <div className="my-3 border-t border-border pt-3">
              <p className="px-3.5 pb-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                More from Kondo
              </p>
              {secondaryNavigation.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  pathname={pathname}
                  onNavigate={() => setMenuOpen(false)}
                />
              ))}
            </div>
            {isAdmin ? (
              <NavLink
                href="/admin"
                icon={Settings}
                label="Admin"
                pathname={pathname}
                onNavigate={() => setMenuOpen(false)}
              />
            ) : null}
            <button
              className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              onClick={logout}
              type="button"
            >
              <LogOut className="h-5 w-5" /> Sign out
            </button>
          </nav>
        </aside>
      </div>

      <nav
        aria-label="Mobile quick navigation"
        className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-3xl border border-border bg-card/95 p-1.5 text-card-foreground shadow-[0_16px_50px_rgba(16,24,40,0.2)] backdrop-blur-xl lg:hidden"
      >
        {navigation.map(({ href, icon: Icon, label, aliases }) => {
          const active =
            pathname === href ||
            pathname.startsWith(`${href}/`) ||
            aliases?.some(
              (alias) => pathname === alias || pathname.startsWith(`${alias}/`),
            );
          return (
            <Link
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={cn(
                "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-bold",
                active
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground",
              )}
              href={href}
              key={href}
            >
              <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
              <span className="max-w-full truncate px-1">{label}</span>
              {href === "/messages" && user.messageUnreadCount ? (
                <span className="absolute right-2 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-warning px-1 text-[8px] font-black text-warning-foreground">
                  {user.messageUnreadCount > 99
                    ? "99+"
                    : user.messageUnreadCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
