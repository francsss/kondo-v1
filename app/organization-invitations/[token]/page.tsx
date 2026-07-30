import Link from "next/link";
import { KondoLogo } from "@/components/KondoLogo";
import { InvitationDecision } from "@/components/organizations/InvitationDecision";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { getOrganizationInvitationPreview } from "@/lib/organization-invitations";
import { getCurrentUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function OrganizationInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const token = (await params).token;
  const [invitation, user] = await Promise.all([
    getOrganizationInvitationPreview(token),
    getCurrentUser(),
  ]);
  const path = `/organization-invitations/${token}`;
  return (
    <main className="min-h-screen bg-background px-5 py-6 sm:px-10">
      <div className="mx-auto max-w-2xl">
        <KondoLogo />
        <section className="mt-14 rounded-4xl border border-border bg-card p-7 text-center shadow-soft sm:p-10">
          <Avatar
            className="mx-auto h-20 w-20 rounded-3xl text-xl"
            firstName={invitation.organization.publicName}
            lastName=""
            mediaId={invitation.organization.logoMediaId}
          />
          <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
            Organization invitation
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">
            Join {invitation.organization.publicName}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
            {invitation.invitedBy.firstName} {invitation.invitedBy.lastName}{" "}
            invited you as {invitation.intendedRole.toLowerCase()}. You always
            sign in through your own personal Kondo account.
          </p>
          <p className="mt-4 text-xs font-semibold text-muted-foreground">
            Status: {invitation.status.toLowerCase()} · expires{" "}
            {new Date(invitation.expiresAt).toLocaleString()}
          </p>
          <div className="mt-7">
            {invitation.status !== "PENDING" ? (
              <Button asChild>
                <Link href="/home">Continue to Kondo</Link>
              </Button>
            ) : user ? (
              <InvitationDecision invitationId={invitation.id} />
            ) : (
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link href={`/login?next=${encodeURIComponent(path)}`}>
                    Sign in to respond
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={`/register?next=${encodeURIComponent(path)}`}>
                    Create personal account
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
