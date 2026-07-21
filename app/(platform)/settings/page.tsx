import type { Metadata } from "next";
import Link from "next/link";
import {
  BellRing,
  Bell,
  ChevronRight,
  Laptop,
  Languages,
  LogOut,
  LockKeyhole,
  Palette,
  UserRound,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Settings" };

const settings = [
  {
    href: "/profile/edit",
    title: "Profile & identity",
    description:
      "Edit your avatar, bio, private contact field and profile visibility.",
    icon: UserRound,
  },
  {
    href: "/settings/appearance",
    title: "Appearance",
    description: "Choose Light, Dark, or System and keep it across devices.",
    icon: Palette,
  },
  {
    href: "/settings/privacy",
    title: "Privacy",
    description: "Control who can see each part of your profile.",
    icon: LockKeyhole,
  },
  {
    href: "/settings/notifications",
    title: "Notification preferences",
    description:
      "Choose useful message, reply, marketplace, and digest updates.",
    icon: BellRing,
  },
  {
    href: "/notifications",
    title: "Notification inbox",
    description: "Review the useful updates already sent to your account.",
    icon: Bell,
  },
  {
    href: "/settings/language",
    title: "Language",
    description: "Save your preferred product language.",
    icon: Languages,
  },
  {
    href: "/settings/sessions",
    title: "Sessions & devices",
    description: "Review active sessions and revoke access.",
    icon: Laptop,
  },
  {
    href: "/settings/account",
    title: "Account",
    description: "Sign out or request an export or account deletion.",
    icon: LogOut,
  },
] as const;

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-[920px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="A clear home for account, notification, language, appearance, and privacy preferences as those controls expand."
        eyebrow="Your Kondo"
        title="Settings"
      />
      <Card className="mt-8 overflow-hidden p-0">
        {settings.map(({ href, title, description, icon: Icon }, index) => (
          <Link
            className={`group flex items-center gap-4 p-5 transition hover:bg-slate-50 dark:hover:bg-white/5 ${index ? "border-t border-slate-100 dark:border-white/10" : ""}`}
            href={href}
            key={href}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10 dark:text-emerald-300">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-black text-kondo-ink dark:text-white">
                {title}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {description}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-kondo-green" />
          </Link>
        ))}
      </Card>
    </div>
  );
}
