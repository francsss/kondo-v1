import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProfileEditor } from "@/components/features/profile/ProfileEditor";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { getOwnProfileSettings } from "@/lib/profiles";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const user = await requireUser();
  const profile = await getOwnProfileSettings(user.id);
  return (
    <div className="mx-auto max-w-[980px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <div className="flex flex-wrap justify-between gap-3">
        <Button asChild size="sm" variant="ghost">
          <Link href="/profile">
            <ArrowLeft className="h-4 w-4" /> Profile
          </Link>
        </Button>
        <Button asChild size="sm" variant="secondary">
          <Link href="/onboarding">Edit study details</Link>
        </Button>
      </div>
      <div className="mt-4">
        <PageHeader
          description="Keep your identity useful to the Kondo community while deciding exactly which student details other people can see."
          eyebrow="Your Kondo"
          title="Edit profile"
        />
      </div>
      <div className="mt-7">
        <ProfileEditor profile={profile} />
      </div>
    </div>
  );
}
