import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminOpportunityModeration } from "@/components/features/admin/AdminOpportunityModeration";
import { hasAdminPermission } from "@/lib/authorization";
import { opportunityLifecycleLabel } from "@/lib/opportunity-lifecycle";
import { opportunityTypeDefinition } from "@/lib/opportunity-types";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Opportunity review — Admin",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function AdminOpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdminPermission("OPPORTUNITIES_VIEW");
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: (await params).id },
    select: {
      id: true,
      slug: true,
      title: true,
      shortDescription: true,
      description: true,
      type: true,
      lifecycle: true,
      applicationMethod: true,
      officialSourceUrl: true,
      externalApplicationUrl: true,
      applicationEmail: true,
      applicationDeadline: true,
      publisherVisibleNote: true,
      moderationNote: true,
      publicationBlockedAt: true,
      publisherOrganization: {
        select: { publicName: true, slug: true, verificationStatus: true },
      },
      _count: { select: { applications: true, savedBy: true } },
    },
  });
  if (!opportunity) notFound();
  const reportCount = await prisma.report.count({
    where: { targetType: "Opportunity", targetId: opportunity.id },
  });
  return (
    <div className="mx-auto max-w-[960px] px-4 py-8">
      <Link
        href="/admin/opportunities"
        className="text-sm font-bold text-muted-foreground hover:underline"
      >
        ← Opportunities
      </Link>
      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full bg-kondo-green/10 px-3 py-1 text-xs font-bold text-kondo-green">
          {opportunityTypeDefinition(opportunity.type).label}
        </span>
        <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-bold dark:bg-white/10">
          {opportunityLifecycleLabel(opportunity.lifecycle)}
        </span>
      </div>
      <h1 className="mt-3 text-3xl font-black tracking-[-0.04em]">
        {opportunity.title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {opportunity.publisherOrganization?.publicName ?? "Kondo editorial"} ·{" "}
        {opportunity._count.applications} applications · {reportCount} reports
      </p>
      <section className="mt-7 rounded-3xl bg-black/[0.03] p-5 dark:bg-white/[0.04]">
        <h2 className="font-black">Listing snapshot</h2>
        <p className="mt-2 text-sm font-semibold">
          {opportunity.shortDescription}
        </p>
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">
          {opportunity.description}
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-bold">Application method</dt>
            <dd>{opportunity.applicationMethod}</dd>
          </div>
          <div>
            <dt className="font-bold">Deadline</dt>
            <dd>
              {opportunity.applicationDeadline?.toLocaleString("en-GB") ??
                "Not stated"}
            </dd>
          </div>
          <div>
            <dt className="font-bold">Official source</dt>
            <dd className="break-all">
              {opportunity.officialSourceUrl ?? "Not stated"}
            </dd>
          </div>
          <div>
            <dt className="font-bold">Application destination</dt>
            <dd className="break-all">
              {opportunity.externalApplicationUrl ??
                opportunity.applicationEmail ??
                "Kondo"}
            </dd>
          </div>
        </dl>
      </section>
      {opportunity.publisherVisibleNote ? (
        <p className="mt-4 rounded-2xl bg-sky-50 p-4 text-sm dark:bg-sky-400/10">
          Previous publisher note: {opportunity.publisherVisibleNote}
        </p>
      ) : null}
      {opportunity.moderationNote ? (
        <p className="mt-3 rounded-2xl bg-amber-50 p-4 text-sm dark:bg-amber-400/10">
          Internal moderation note: {opportunity.moderationNote}
        </p>
      ) : null}
      {hasAdminPermission(admin.role, "OPPORTUNITIES_REVIEW") ? (
        <AdminOpportunityModeration opportunityId={opportunity.id} />
      ) : null}
    </div>
  );
}
