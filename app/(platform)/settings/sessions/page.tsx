import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { SessionsPanel } from "@/components/features/settings/SessionsPanel";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSessionCredential, listUserSessions } from "@/lib/settings";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Sessions and devices" };

export default async function SessionsSettingsPage() {
  const user = await requireUser();
  const cookieStore = await cookies();
  const credential = await getSessionCredential(
    cookieStore.get(AUTH_COOKIE_NAME)?.value,
  );
  const sessions =
    credential && credential.userId === user.id
      ? await listUserSessions(user.id, credential.tokenHash)
      : [];
  return (
    <div className="mx-auto max-w-[920px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Button asChild size="sm" variant="ghost">
        <Link href="/settings">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
      </Button>
      <div className="mt-4">
        <PageHeader
          description="See every active database session and revoke access immediately."
          eyebrow="Settings"
          title="Sessions & devices"
        />
      </div>
      <div className="mt-7">
        <SessionsPanel initialSessions={sessions} />
      </div>
    </div>
  );
}
