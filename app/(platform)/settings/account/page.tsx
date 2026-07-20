import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AccountRequestPanel } from "@/components/features/profile/AccountRequestPanel";
import { EmailVerificationBanner } from "@/components/features/settings/EmailVerificationBanner";
import { LogoutButton } from "@/components/features/settings/LogoutButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listOwnAccountRequests } from "@/lib/profiles";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Account settings" };

export default async function AccountSettingsPage() {
  const user = await requireUser();
  const requests = await listOwnAccountRequests(user.id);
  return (
    <div className="mx-auto max-w-[920px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Button asChild size="sm" variant="ghost">
        <Link href="/settings">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
      </Button>
      <div className="mt-4">
        <PageHeader
          description="Control access to this device and submit reviewed data or deletion requests."
          eyebrow="Settings"
          title="Account"
        />
      </div>
      <div className="mt-7 space-y-6">
        {!user.emailVerifiedAt ? (
          <EmailVerificationBanner email={user.email} />
        ) : null}
        <Card>
          <h2 className="font-black text-kondo-ink dark:text-white">
            Sign out
          </h2>
          <p className="mb-4 mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">
            This immediately revokes the current database session and removes
            its session cookie.
          </p>
          <LogoutButton />
        </Card>
        <AccountRequestPanel requests={requests} />
      </div>
    </div>
  );
}
