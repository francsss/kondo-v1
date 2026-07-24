import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OfficialVerificationPanel } from "@/components/features/official-profile/OfficialVerificationPanel";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { getOwnVerificationState } from "@/lib/official-profiles";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Official profile" };

export default async function OfficialProfileSettingsPage() {
  const user = await requireUser();
  const state = await getOwnVerificationState(user);
  return (
    <main className="mx-auto max-w-[1180px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Button asChild size="sm" variant="ghost">
        <Link href="/settings">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
      </Button>
      <div className="mt-4">
        <PageHeader
          description="A confidential, human-reviewed way to identify real organizations on Kondo."
          eyebrow="Kondo trust"
          title="Official profile"
        />
      </div>
      <OfficialVerificationPanel state={state} />
    </main>
  );
}
