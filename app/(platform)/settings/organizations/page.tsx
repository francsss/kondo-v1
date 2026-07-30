import Link from "next/link";
import { Building2, ChevronRight, Plus, ShieldCheck } from "lucide-react";
import { listManagedOrganizations } from "@/lib/organizations";
import { requireUser } from "@/lib/server-auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function OrganizationSettingsPage() {
  const user = await requireUser();
  const memberships = await listManagedOrganizations(user.id);
  return (
    <div className="mx-auto max-w-[920px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Organizations are managed through personal Kondo accounts. Team members should never share passwords."
        eyebrow="Account & work"
        title="Your organizations"
      />
      <div className="mt-7 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/onboarding/organization?new=1">
            <Plus className="h-4 w-4" /> Create organization
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/settings">Back to settings</Link>
        </Button>
      </div>

      {memberships.length ? (
        <div className="mt-8 grid gap-4">
          {memberships.map(({ role, organization }) => (
            <Card className="p-0" key={organization.id}>
              <Link
                className="group flex items-center gap-4 p-5 transition hover:bg-muted/50"
                href={
                  organization.setupCompletedAt
                    ? `/organizations/${organization.slug}/dashboard`
                    : `/onboarding/organization?id=${organization.id}`
                }
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
                  <Building2 className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-black">
                      {organization.publicName}
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                      {organization.lifecycleStatus}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {role.toLowerCase()} ·{" "}
                    {organization.setupCompletedAt
                      ? "Setup complete"
                      : `Continue from step ${organization.setupStep}`}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="mt-8 p-8 text-center sm:p-12">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
            <Building2 className="h-6 w-6" />
          </span>
          <h2 className="mt-5 text-xl font-black">No organization yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Create a draft for a company, university, association or service
            provider. Your personal profile remains separate.
          </p>
        </Card>
      )}

      <p className="mt-7 flex items-start gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-xs leading-5 text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-kondo-green" />
        Team access, organization verification and audit history live inside
        each professional workspace. Drafts and private verification documents
        are never publicly searchable.
      </p>
    </div>
  );
}
