"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Bell,
  Bookmark,
  Building2,
  Clapperboard,
  ClipboardList,
  Compass,
  Globe2,
  GraduationCap,
  Home,
  House,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Package,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  Target,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";
import { ProductAnalyticsIdentity } from "@/components/analytics/ProductAnalytics";
import { PresenceHeartbeat } from "@/components/app/PresenceHeartbeat";
import { ExploreMenu } from "@/components/features/explore/ExploreMenu";
import { KondoPet } from "@/components/features/feedback/KondoPet";
import { NotificationExperience } from "@/components/features/notifications/NotificationExperience";
import { RestoreStoryScroll } from "@/components/features/stories/RestoreStoryScroll";
import { KondoLogo } from "@/components/KondoLogo";
import {
  WorkspaceSwitcher,
  type WorkspaceSwitcherItem,
} from "@/components/organizations/WorkspaceSwitcher";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { canAccessAdmin } from "@/lib/authorization";
import { usesImmersiveAppShell } from "@/lib/app-shell";
import {
  activeWorkspaceNavigationKey,
  type WorkspaceNavigationIconKey,
  type WorkspaceNavigationItem,
} from "@/lib/organization-workspace-navigation";
import {
  MESSAGE_COUNT_EVENT,
  NOTIFICATION_COUNT_EVENT,
} from "@/lib/notification-client";
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
    notificationSounds?: boolean;
    notificationHaptics?: boolean;
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
  {
    href: "/student-hub",
    label: "Student Hub",
    icon: GraduationCap,
    aliases: ["/guides", "/help"],
  },
  // Marketplace takes the slot Discover held; Discover takes Marketplace's
  // slot in the secondary menu below. Position swap only — each entry keeps
  // its own route, label and icon.
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/communities", label: "Communities", icon: Users },
  { href: "/messages", label: "Messages", icon: MessageCircle },
];

const secondaryNavigation: NavigationItem[] = [
  { href: "/housing", label: "Housing", icon: House },
  { href: "/stories", label: "Student Stories", icon: Clapperboard },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/discover", label: "Discover", icon: Compass },
];

/**
 * When an organization workspace is active the mobile bar must stop presenting
 * personal student modules as though the member were still browsing Kondo for
 * themselves. The same navigation architecture is reused — only the
 * configuration changes with the active workspace.
 */
export type OrganizationWorkspaceContext = {
  slug: string;
  publicName: string;
  navigation: WorkspaceNavigationItem[];
};

const WORKSPACE_MOBILE_ICONS: Record<WorkspaceNavigationIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  profile: Building2,
  "public-profile": Globe2,
  housing: House,
  opportunities: Target,
  applications: ClipboardList,
  catalog: Package,
  products: Package,
  services: Sparkles,
  inquiries: MessageCircle,
  team: Users,
  verification: ShieldCheck,
  activity: Activity,
  settings: Settings,
};

const kondoPetEnabled = process.env.NEXT_PUBLIC_KONDO_PET_ENABLED !== "false";

export function ThemeToggle({
  presentation = "icon",
}: {
  presentation?: "icon" | "menu";
}) {
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

  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  const Icon = dark ? Sun : Moon;

  if (presentation === "menu") {
    return (
      <button
        aria-label={label}
        aria-pressed={dark}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-wait disabled:opacity-60"
        disabled={!mounted || saving}
        onClick={toggleTheme}
        type="button"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-black text-foreground">
            Appearance
          </span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {mounted ? (dark ? "Dark mode" : "Light mode") : "Device theme"}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "ml-auto flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
            dark ? "bg-kondo-green" : "bg-border",
          )}
        >
          <span
            className={cn(
              "h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
              dark && "translate-x-5",
            )}
          />
        </span>
      </button>
    );
  }

  return (
    <Button
      aria-label={label}
      aria-pressed={dark}
      className="rounded-full"
      disabled={!mounted || saving}
      onClick={toggleTheme}
      size="icon"
      type="button"
      variant="ghost"
    >
      <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
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
  workspaces = [],
  organizationWorkspace = null,
}: {
  children: React.ReactNode;
  user: ShellUser;
  workspaces?: WorkspaceSwitcherItem[];
  organizationWorkspace?: OrganizationWorkspaceContext | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(
    user.notificationUnreadCount ?? 0,
  );
  const [messageUnreadCount, setMessageUnreadCount] = useState(
    user.messageUnreadCount ?? 0,
  );
  const isAdmin = canAccessAdmin(user.role);
  const workspaceNavigation = organizationWorkspace?.navigation ?? [];
  const workspacePrimary = workspaceNavigation.filter(
    (item) => item.primaryOnMobile,
  );
  const workspaceSecondary = workspaceNavigation.filter(
    (item) => !item.primaryOnMobile,
  );
  const activeWorkspaceKey = organizationWorkspace
    ? activeWorkspaceNavigationKey(workspaceNavigation, pathname)
    : null;

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

  useEffect(() => {
    const updateCount = (event: Event) => {
      const unreadCount = (event as CustomEvent<{ unreadCount?: unknown }>)
        .detail?.unreadCount;
      const delta = (
        event as CustomEvent<{ unreadCount?: unknown; delta?: unknown }>
      ).detail?.delta;
      if (typeof unreadCount === "number") {
        setNotificationUnreadCount(Math.max(0, Math.floor(unreadCount)));
      } else if (typeof delta === "number") {
        setNotificationUnreadCount((current) =>
          Math.max(0, current + Math.trunc(delta)),
        );
      }
    };
    window.addEventListener(NOTIFICATION_COUNT_EVENT, updateCount);
    return () =>
      window.removeEventListener(NOTIFICATION_COUNT_EVENT, updateCount);
  }, []);

  useEffect(() => {
    const updateCount = (event: Event) => {
      const unreadCount = (event as CustomEvent<{ unreadCount?: unknown }>)
        .detail?.unreadCount;
      const delta = (
        event as CustomEvent<{ unreadCount?: unknown; delta?: unknown }>
      ).detail?.delta;
      if (typeof unreadCount === "number") {
        setMessageUnreadCount(Math.max(0, Math.floor(unreadCount)));
      } else if (typeof delta === "number") {
        setMessageUnreadCount((current) =>
          Math.max(0, current + Math.trunc(delta)),
        );
      }
    };
    window.addEventListener(MESSAGE_COUNT_EVENT, updateCount);
    return () => window.removeEventListener(MESSAGE_COUNT_EVENT, updateCount);
  }, []);

  async function logout() {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker
        .getRegistration("/")
        .catch(() => undefined);
      const subscription = await registration?.pushManager
        .getSubscription()
        .catch(() => null);
      if (subscription) {
        await fetch("/api/notifications/push", {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => null);
        await subscription.unsubscribe().catch(() => false);
      }
    }
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
        <NotificationExperience
          hapticsEnabled={user.preference?.notificationHaptics ?? true}
          soundEnabled={user.preference?.notificationSounds ?? false}
        />
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
      <NotificationExperience
        hapticsEnabled={user.preference?.notificationHaptics ?? true}
        soundEnabled={user.preference?.notificationSounds ?? false}
      />
      <ProductAnalyticsIdentity user={user} />
      <RestoreStoryScroll />
      <KondoPet enabled={kondoPetEnabled} />
      <aside
        aria-label="Desktop navigation"
        className="fixed inset-y-0 left-0 z-40 hidden w-[248px] overflow-hidden border-r border-border bg-card/90 px-4 py-6 backdrop-blur-xl lg:flex lg:flex-col"
      >
        <div className="flex h-11 shrink-0 items-center px-2">
          <KondoLogo href="/home" />
        </div>
        <div
          className="mt-8 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pr-1"
          data-navigation-scroll=""
        >
          <nav aria-label="Primary navigation" className="space-y-1">
            {organizationWorkspace
              ? workspaceNavigation.map((item) => (
                  <NavLink
                    href={item.href}
                    icon={WORKSPACE_MOBILE_ICONS[item.icon]}
                    key={item.key}
                    label={item.label}
                    pathname={pathname}
                  />
                ))
              : navigation.map((item) => (
                  <NavLink
                    badgeCount={
                      item.href === "/messages" ? messageUnreadCount : undefined
                    }
                    key={item.href}
                    {...item}
                    pathname={pathname}
                  />
                ))}
          </nav>

          <div className="mt-6 border-t border-border pt-4">
            <div className="space-y-1">
              <WorkspaceSwitcher
                presentation="menu"
                user={user}
                workspaces={workspaces}
              />
              {organizationWorkspace ? (
                <NavLink
                  href="/home"
                  icon={UserRound}
                  label="Return to Personal"
                  pathname={pathname}
                />
              ) : (
                secondaryNavigation.map((item) => (
                  <NavLink key={item.href} {...item} pathname={pathname} />
                ))
              )}
              <ThemeToggle presentation="menu" />
            </div>
          </div>

          <div className="mt-auto space-y-2 pt-2">
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
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mx-auto flex h-full max-w-[1440px] items-center gap-3">
            <div className="flex h-11 shrink-0 items-center lg:hidden">
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
              className="group mx-auto flex h-11 min-w-0 flex-1 items-center gap-3 rounded-full border border-border bg-card px-4 text-sm text-muted-foreground shadow-sm transition hover:border-primary/50 hover:shadow-md sm:mx-0 sm:max-w-xl"
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
            <div className="ml-auto flex h-11 shrink-0 items-center gap-1">
              <Button asChild className="relative" size="icon" variant="ghost">
                <Link
                  aria-label={`Notifications${
                    notificationUnreadCount
                      ? `, ${notificationUnreadCount} unread`
                      : ""
                  }`}
                  href="/notifications"
                >
                  <Bell aria-hidden="true" className="h-[18px] w-[18px]" />
                  {notificationUnreadCount ? (
                    <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-background bg-warning px-1 text-[9px] font-black leading-none text-warning-foreground">
                      {notificationUnreadCount > 99
                        ? "99+"
                        : notificationUnreadCount}
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
                  seed={user.id}
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
            "safe-bottom relative isolate flex h-[var(--visual-viewport-height,100dvh)] w-[min(84vw,320px)] max-w-full flex-col overflow-y-auto bg-white p-5 text-card-foreground shadow-[14px_0_48px_rgba(15,74,55,0.14)] transition-transform duration-300 after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-[3px] after:bg-gradient-to-b after:from-transparent after:via-kondo-green/15 after:to-transparent after:blur-[1px] dark:bg-card dark:shadow-[14px_0_48px_rgba(0,0,0,0.45)] dark:after:via-kondo-lime/10",
            menuOpen ? "translate-x-0" : "-translate-x-full",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex h-11 shrink-0 items-center justify-between">
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
          <nav className="mt-8 flex min-h-0 flex-1 flex-col">
            <div className="space-y-1">
              <WorkspaceSwitcher
                onNavigate={() => setMenuOpen(false)}
                presentation="menu"
                user={user}
                workspaces={workspaces}
              />
              <ThemeToggle presentation="menu" />
            </div>

            {organizationWorkspace ? (
              <div className="my-5 border-t border-border/40 pt-5">
                <p className="px-3.5 pb-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                  {organizationWorkspace.publicName}
                </p>
                <div className="space-y-1">
                  {workspaceSecondary.map((item) => (
                    <NavLink
                      href={item.href}
                      icon={WORKSPACE_MOBILE_ICONS[item.icon]}
                      key={item.key}
                      label={item.label}
                      onNavigate={() => setMenuOpen(false)}
                      pathname={pathname}
                    />
                  ))}
                  <NavLink
                    href="/home"
                    icon={UserRound}
                    label="Return to Personal"
                    onNavigate={() => setMenuOpen(false)}
                    pathname={pathname}
                  />
                </div>
              </div>
            ) : null}

            {!organizationWorkspace ? (
              <div className="my-5 border-t border-border/40 pt-5">
                <div className="space-y-1">
                  {secondaryNavigation.map((item) => (
                    <NavLink
                      key={item.href}
                      {...item}
                      label={
                        item.href === "/stories" ? "Student Story" : item.label
                      }
                      pathname={pathname}
                      onNavigate={() => setMenuOpen(false)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-auto space-y-1 border-t border-border/40 pt-5">
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
            </div>
          </nav>
        </aside>
      </div>

      {organizationWorkspace ? (
        <nav
          aria-label={`${organizationWorkspace.publicName} workspace navigation`}
          className="fixed inset-x-3 bottom-3 z-40 grid auto-cols-fr grid-flow-col rounded-3xl border border-border bg-card/95 p-1.5 text-card-foreground shadow-[0_16px_50px_rgba(16,24,40,0.2)] backdrop-blur-xl lg:hidden"
        >
          {workspacePrimary.map((item) => {
            const Icon = WORKSPACE_MOBILE_ICONS[item.icon];
            const active = item.key === activeWorkspaceKey;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-bold",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground",
                )}
                href={item.href}
                key={item.key}
              >
                <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            );
          })}
          <button
            aria-controls="mobile-navigation"
            aria-expanded={menuOpen}
            className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-bold text-muted-foreground"
            onClick={() => setMenuOpen(true)}
            type="button"
          >
            <MoreHorizontal aria-hidden="true" className="h-[18px] w-[18px]" />
            <span className="max-w-full truncate px-1">More</span>
          </button>
        </nav>
      ) : (
        <nav
          aria-label="Mobile quick navigation"
          className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-3xl border border-border bg-card/95 p-1.5 text-card-foreground shadow-[0_16px_50px_rgba(16,24,40,0.2)] backdrop-blur-xl lg:hidden"
        >
          {navigation.map(({ href, icon: Icon, label, aliases }) => {
            const active =
              pathname === href ||
              pathname.startsWith(`${href}/`) ||
              aliases?.some(
                (alias) =>
                  pathname === alias || pathname.startsWith(`${alias}/`),
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
                {href === "/messages" && messageUnreadCount ? (
                  <span className="absolute right-2 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-warning px-1 text-[8px] font-black text-warning-foreground">
                    {messageUnreadCount > 99 ? "99+" : messageUnreadCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
