import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LanguageSettings } from "@/components/features/settings/LanguageSettings";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { getUserPreferences } from "@/lib/settings";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Language settings" };

export default async function LanguageSettingsPage() {
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
          description="Save the language Kondo should use as reviewed translations become available."
          eyebrow="Settings"
          title="Language"
        />
      </div>
      <div className="mt-7">
        <LanguageSettings initialLanguage={preferences.language} />
      </div>
    </div>
  );
}
