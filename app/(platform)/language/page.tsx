import type { Metadata } from "next";
import { LanguageSettings } from "@/components/features/settings/LanguageSettings";
import { PageHeader } from "@/components/ui/PageHeader";
import { getUserPreferences } from "@/lib/settings";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Language" };

export default async function LanguagePage() {
  const user = await requireUser();
  const preferences = await getUserPreferences(user.id);
  return (
    <div className="mx-auto max-w-[920px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Save the language Kondo should use as reviewed translations become available."
        eyebrow="Speak Kondo"
        title="Language"
      />
      <div className="mt-8">
        <LanguageSettings initialLanguage={preferences.language} />
      </div>
    </div>
  );
}
