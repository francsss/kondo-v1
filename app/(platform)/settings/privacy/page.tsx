import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PrivacySettings } from "@/components/features/settings/PrivacySettings";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { getOwnProfileSettings } from "@/lib/profiles";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Privacy settings" };

export default async function PrivacySettingsPage() {
  const user = await requireUser();
  const profile = await getOwnProfileSettings(user.id);
  return (
    <div className="mx-auto max-w-[920px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Button asChild size="sm" variant="ghost">
        <Link href="/settings">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
      </Button>
      <div className="mt-4">
        <PageHeader
          description="Decide who can see each profile section without weakening community or content visibility rules."
          eyebrow="Settings"
          title="Privacy"
        />
      </div>
      <div className="mt-7">
        <PrivacySettings preferences={profile} />
      </div>
    </div>
  );
}
