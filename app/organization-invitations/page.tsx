import { redirect } from "next/navigation";
import { InvitationDecision } from "@/components/organizations/InvitationDecision";
import { KondoLogo } from "@/components/KondoLogo";
import { Avatar } from "@/components/ui/Avatar";
import { listPendingOrganizationInvitations } from "@/lib/organization-invitations";
import { getCurrentUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function OrganizationInvitationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Forganization-invitations");
  const invitations = await listPendingOrganizationInvitations(user.email);
  return (
    <main className="min-h-screen bg-background px-5 py-6 sm:px-10">
      <div className="mx-auto max-w-3xl">
        <KondoLogo />
        <section className="mt-12">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
            Professional workspaces
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">
            Organization invitations
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Joining never changes your personal Kondo account or password.
          </p>
          <div className="mt-7 grid gap-4">
            {invitations.map((invitation) => (
              <article
                className="rounded-4xl border border-border bg-card p-6 shadow-sm"
                key={invitation.id}
              >
                <div className="flex items-center gap-4">
                  <Avatar
                    className="h-14 w-14 rounded-2xl"
                    firstName={invitation.organization.publicName}
                    lastName=""
                    mediaId={invitation.organization.logoMediaId}
                  />
                  <div>
                    <h2 className="text-xl font-black">
                      {invitation.organization.publicName}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Invited as {invitation.intendedRole.toLowerCase()} by{" "}
                      {invitation.invitedBy.firstName}{" "}
                      {invitation.invitedBy.lastName}
                    </p>
                  </div>
                </div>
                <div className="mt-5">
                  <InvitationDecision invitationId={invitation.id} />
                </div>
              </article>
            ))}
            {!invitations.length ? (
              <div className="rounded-4xl border border-border bg-card p-10 text-center shadow-sm">
                <h2 className="text-xl font-black">No pending invitation</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  New organization invitations for {user.email} will appear
                  here.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
