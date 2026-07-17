import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NotificationSettings } from "@/components/features/settings/NotificationSettings";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { getUserPreferences } from "@/lib/settings";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Notification settings" };

export default async function NotificationSettingsPage() {
  const user = await requireUser();
  const preferences = await getUserPreferences(user.id);
  return (
    <div className="mx-auto max-w-[920px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Button asChild size="sm" variant="ghost">
        <Link href="/settings">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
      </Button>
      <div className="mt-4">
        <PageHeader
          description="Save which useful updates Kondo should produce for your account."
          eyebrow="Settings"
          title="Notification preferences"
        />
      </div>
      <div className="mt-7">
        <NotificationSettings preferences={preferences} />
      </div>
    </div>
  );
}
