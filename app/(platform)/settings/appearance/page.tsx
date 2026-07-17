import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppearanceSettings } from "@/components/features/settings/AppearanceSettings";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { getUserPreferences } from "@/lib/settings";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Appearance settings" };

export default async function AppearanceSettingsPage() {
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
          description="Use one appearance everywhere or follow each device automatically."
          eyebrow="Settings"
          title="Appearance"
        />
      </div>
      <div className="mt-7">
        <AppearanceSettings initialTheme={preferences.theme} />
      </div>
    </div>
  );
}
