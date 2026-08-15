import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  Users,
} from "lucide-react";
import { OrganizationVisibilityPanel } from "@/components/organizations/OrganizationVisibilityPanel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { hasOrganizationPermission } from "@/lib/organization-authorization";
import { ORGANIZATION_CAPABILITIES } from "@/lib/organization-capabilities";
import { opportunitySetupState } from "@/lib/organization-workspace-navigation";
import { listOrganizationActivity } from "@/lib/organization-workspaces";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";
import { getOrganizationPublicationReadiness } from "@/lib/organization-publication";
import { requireUser } from "@/lib/server-auth";

export default async function OrganizationDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const slug = (await params).slug;
  const { workspace, events } = await listOrganizationActivity(
    user.id,
    slug,
    1,
  );
  const { organization, membership, counts, completeness } = workspace;
  const readiness = await getOrganizationPublicationReadiness(organization.id);
  await captureServerProductEvent({
    distinctId: user.id,
    event: PRODUCT_EVENTS.ORGANIZATION_WORKSPACE_OPENED,
    properties: {
      organization_type: organization.type,
      organization_role: membership.role,
    },
  });
  const enabled = new Map(
    organization.capabilities.map((capability) => [
      capability.key,
      capability.status,
    ]),
  );

  // Quick actions are derived from the same permissions the routes enforce, so
  // the dashboard never offers a link that answers 403 or 404.
  const membershipContext = {
    role: membership.storedRole,
    status: membership.status,
  };
  const setup = opportunitySetupState({
    organization,
    membership: membershipContext,
    profileComplete: completeness.missing.length === 0,
  });
  const permitted = (
    permission: Parameters<typeof hasOrganizationPermission>[1],
  ) => hasOrganizationPermission(membershipContext, permission);

  const quickActions: Array<{ label: string; href: string; hint?: string }> =
    [];
  if (setup.canCreateDraft) {
    quickActions.push({
      label: "Create opportunity",
      href: `/organizations/${slug}/opportunities/new`,
    });
  }
  if (permitted("ORGANIZATION_VIEW_OPPORTUNITIES")) {
    quickActions.push({
      label: "Manage opportunities",
      href: `/organizations/${slug}/opportunities`,
      hint: setup.blockedReason ?? undefined,
    });
  }
  if (permitted("ORGANIZATION_VIEW_APPLICATIONS")) {
    quickActions.push({
      label: "Review applications",
      href: `/organizations/${slug}/opportunities/applications`,
    });
  }
  if (
    enabled.get("HOUSING") === "ENABLED" &&
    permitted("ORGANIZATION_CREATE_HOUSING")
  ) {
    quickActions.push({
      label: "Create Housing listing",
      href: `/housing/create?organizationId=${organization.id}`,
    });
  }
  if (permitted("ORGANIZATION_EDIT_PROFILE")) {
    quickActions.push({
      label: "Edit public profile",
      href: `/organizations/${slug}/public-profile`,
    });
  }
  if (permitted("ORGANIZATION_MANAGE_VERIFICATION")) {
    quickActions.push({
      label: "Complete verification",
      href: `/organizations/${slug}/verification`,
    });
  }
  if (permitted("ORGANIZATION_INVITE_MEMBERS")) {
    quickActions.push({
      label: "Invite team member",
      href: `/organizations/${slug}/team`,
    });
  }

  return (
    <div className="grid gap-6">
      {/*
       * First thing in the workspace, because it answers the question an owner
       * cannot otherwise answer without making a second account: can anyone
       * actually find us?
       */}
      <OrganizationVisibilityPanel
        state={{
          slug: organization.slug,
          publicProfileStatus: organization.publicProfileStatus,
          missing: readiness.missingRequirements,
          blocking: readiness.blockingReasons,
          canPublish: hasOrganizationPermission(
            { role: membership.storedRole, status: membership.status },
            "ORGANIZATION_MANAGE_PUBLICATION",
          ),
        }}
      />

      <section className="grid gap-5 rounded-4xl bg-gradient-to-br from-kondo-forest via-kondo-green to-emerald-600 p-6 text-white shadow-lift sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/65">
            Welcome to your workspace
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-[-0.04em] sm:text-4xl">
            Build trust around {organization.publicName}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
            Complete the professional identity, invite the right people and
            prepare the organization for Kondo verification.
          </p>
        </div>
        <Button
          asChild
          className="self-end bg-white text-kondo-forest hover:bg-white/90"
        >
          <Link href={`/organizations/${slug}/profile`}>
            Continue setup <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={CheckCircle2}
          label="Profile complete"
          value={`${completeness.percentage}%`}
        />
        <Metric
          icon={Users}
          label="Active teammates"
          value={String(counts.activeMembers)}
        />
        <Metric
          icon={Clock3}
          label="Pending invitations"
          value={String(counts.pendingInvitations)}
        />
        <Metric
          icon={ShieldCheck}
          label="Verification"
          value={organization.verificationStatus
            .replaceAll("_", " ")
            .toLowerCase()}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.75fr)]">
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Setup progress</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Every item improves the organization identity shown across Kondo
                later.
              </p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-black">
              {completeness.completed}/{completeness.total} complete
            </span>
          </div>
          <div
            aria-label={`${completeness.percentage}% profile complete`}
            className="mt-5 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={completeness.percentage}
          >
            <div
              className="h-full rounded-full bg-kondo-green transition-[width] motion-reduce:transition-none"
              style={{ width: `${completeness.percentage}%` }}
            />
          </div>
          {completeness.missing.length ? (
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {completeness.missing.map((item) => (
                <li
                  className="flex items-center gap-2 rounded-2xl bg-muted/60 px-3 py-2.5 text-sm font-semibold"
                  key={item.key}
                >
                  <span className="h-2 w-2 rounded-full bg-kondo-green" />
                  {item.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-2xl bg-kondo-mint px-4 py-3 text-sm font-bold text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
              The professional profile foundation is complete.
            </p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-black">Quick actions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only actions this membership can complete are listed.
          </p>
          <div className="mt-4 grid gap-2">
            {quickActions.map((action) => (
              <Link
                className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition hover:bg-muted"
                href={action.href}
                key={action.href + action.label}
              >
                <span className="min-w-0">
                  {action.label}
                  {action.hint ? (
                    <span className="mt-0.5 block text-xs font-semibold text-muted-foreground">
                      {action.hint}
                    </span>
                  ) : null}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section>
        <h2 className="text-2xl font-black tracking-tight">Activity areas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enabled areas prepare future publishing modules; they do not grant
          verification or automatic publishing rights.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ORGANIZATION_CAPABILITIES.map((capability) => {
            const Icon = capability.icon;
            const status = enabled.get(capability.key) ?? "DISABLED";
            return (
              <Card className="p-5" key={capability.key}>
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                    {status.toLowerCase()}
                  </span>
                </div>
                <h3 className="mt-4 font-black">{capability.label}</h3>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  {capability.description}
                </p>
                <p className="mt-4 text-xs font-semibold text-muted-foreground">
                  {status === "ENABLED"
                    ? "Enabled for this organization."
                    : "Not enabled yet."}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">Recent activity</h2>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/organizations/${slug}/activity`}>View all</Link>
          </Button>
        </div>
        <div className="mt-4 divide-y divide-border">
          {events.slice(0, 6).map((event) => (
            <div className="flex gap-3 py-3" key={event.id}>
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-kondo-green" />
              <div>
                <p className="text-sm font-bold">
                  {event.action.replaceAll("_", " ").toLowerCase()}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {event.actor
                    ? `${event.actor.firstName} ${event.actor.lastName}`
                    : "Kondo system"}{" "}
                  · {new Date(event.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
          {!events.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Organization actions will appear here.
            </p>
          ) : null}
        </div>
      </Card>
      <p className="sr-only">Current role: {membership.role}</p>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-5">
      <Icon className="h-5 w-5 text-kondo-green" />
      <p className="mt-4 text-2xl font-black capitalize">{value}</p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">
        {label}
      </p>
    </Card>
  );
}
