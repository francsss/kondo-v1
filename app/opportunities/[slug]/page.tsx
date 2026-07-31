import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicOpportunityBySlug } from "@/lib/opportunities";
import {
  ELIGIBILITY_DISCLAIMER,
  eligibilityVerdictLabel,
  evaluateOpportunityEligibility,
} from "@/lib/opportunity-eligibility";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server-auth";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const opportunity = await getPublicOpportunityBySlug((await params).slug);
  if (!opportunity) return { title: "Opportunity" };
  return {
    title: `${opportunity.title} — ${opportunity.typeLabel}`,
    description: opportunity.summary,
    // Only a live, published opportunity is indexable; a closed historical page
    // stays reachable but is never indexed.
    robots:
      opportunity.applicationWindow.state === "CLOSED"
        ? { index: false, follow: true }
        : undefined,
    alternates: { canonical: `/opportunities/${opportunity.slug}` },
  };
}

export default async function OpportunityPage({ params }: Props) {
  const { slug } = await params;
  const [opportunity, user] = await Promise.all([
    getPublicOpportunityBySlug(slug),
    getCurrentUser(),
  ]);
  if (!opportunity) notFound();

  // Eligibility is computed per viewer on the server and never cached in a
  // shared cache. A signed-out visitor sees the criteria without a verdict.
  const profile = user
    ? await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          studentJourney: true,
          studyLevel: true,
          universityId: true,
          degree: true,
          countryId: true,
          languages: true,
        },
      })
    : null;

  const rules = await prisma.opportunityEligibilityRule.findMany({
    where: { opportunityId: opportunity.id },
    select: {
      id: true,
      ruleType: true,
      operator: true,
      structuredValue: true,
      required: true,
      publicLabel: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  const eligibility = evaluateOpportunityEligibility({
    rules,
    profile: profile
      ? {
          journey: profile.studentJourney,
          studyLevel: profile.studyLevel,
          universityId: profile.universityId,
          fieldOfStudy: profile.degree,
          countryId: profile.countryId,
          languages: profile.languages,
        }
      : null,
  });

  const window = opportunity.applicationWindow;

  return (
    <div className="mx-auto max-w-[900px] px-4 pb-24 pt-8 sm:px-6 lg:pt-12">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/opportunities" className="hover:underline">
          Opportunities
        </Link>
      </nav>

      <header className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-kondo-green/10 px-3 py-1 text-xs font-bold text-kondo-green">
            {opportunity.typeLabel}
          </span>
          {opportunity.publisher.verified ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300">
              Verified organization
            </span>
          ) : null}
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
          {opportunity.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {opportunity.publisher.href ? (
            <Link
              href={opportunity.publisher.href}
              className="font-semibold hover:underline"
            >
              {opportunity.publisher.name}
            </Link>
          ) : (
            <span className="font-semibold">{opportunity.publisher.name}</span>
          )}
          {opportunity.location ? ` · ${opportunity.location}` : ""}
        </p>
      </header>

      <section
        aria-labelledby="apply-heading"
        className="mt-6 rounded-3xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
      >
        <h2
          id="apply-heading"
          className="text-sm font-black uppercase tracking-wide"
        >
          How to apply
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {opportunity.dates.deadline
            ? `Deadline ${new Date(opportunity.dates.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: opportunity.dates.timezone })} (${opportunity.dates.timezone})`
            : opportunity.dates.rolling
              ? "Rolling applications"
              : "No deadline published"}
        </p>

        <div className="mt-4">
          {window.state === "CLOSED" ? (
            <p className="text-sm font-semibold">Applications are closed.</p>
          ) : window.state === "NOT_OPEN" ? (
            <p className="text-sm font-semibold">
              Applications are not open yet.
            </p>
          ) : window.state === "INFORMATION_ONLY" ? (
            <p className="text-sm font-semibold">
              This listing is for information only.
            </p>
          ) : opportunity.externalApplicationUrl ? (
            <a
              href={opportunity.externalApplicationUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex rounded-full bg-kondo-green px-5 py-3 text-sm font-bold text-white"
            >
              Apply on the provider’s website
            </a>
          ) : opportunity.applicationEmail ? (
            <p className="text-sm">
              Apply by email:{" "}
              <span className="font-semibold">
                {opportunity.applicationEmail}
              </span>
            </p>
          ) : window.acceptsKondoApplications ? (
            <Link
              href={`/opportunities/${opportunity.slug}/apply`}
              className="inline-flex rounded-full bg-kondo-green px-5 py-3 text-sm font-bold text-white"
            >
              Apply in Kondo
            </Link>
          ) : (
            <p className="text-sm font-semibold">Applications are closed.</p>
          )}
          {opportunity.externalApplicationUrl ? (
            <p className="mt-2 text-xs text-muted-foreground">
              You are leaving Kondo to apply on the provider’s website.
            </p>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="overview-heading" className="mt-8">
        <h2
          id="overview-heading"
          className="text-lg font-black tracking-[-0.02em]"
        >
          Overview
        </h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">
          {opportunity.description}
        </p>
      </section>

      {opportunity.benefits.length ? (
        <section aria-labelledby="benefits-heading" className="mt-8">
          <h2
            id="benefits-heading"
            className="text-lg font-black tracking-[-0.02em]"
          >
            Benefits
          </h2>
          <ul className="mt-3 space-y-2">
            {opportunity.benefits.map((benefit) => (
              <li key={benefit.id} className="text-sm">
                <span className="font-semibold">
                  {benefit.type.replace(/_/g, " ")}
                </span>
                {benefit.amount
                  ? ` — ${benefit.amount.currency} ${benefit.amount.value.toLocaleString()}`
                  : ""}
                {benefit.description ? ` — ${benefit.description}` : ""}
                {/* Confirmed, possible and unspecified stay visibly distinct. */}
                <span className="ml-2 text-xs text-muted-foreground">
                  {benefit.confidence === "CONFIRMED"
                    ? "Confirmed"
                    : benefit.confidence === "POSSIBLE"
                      ? "Possible"
                      : "Not specified"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="eligibility-heading" className="mt-8">
        <h2
          id="eligibility-heading"
          className="text-lg font-black tracking-[-0.02em]"
        >
          Eligibility
        </h2>
        {user ? (
          <p className="mt-2 text-sm font-semibold">
            {eligibilityVerdictLabel(eligibility.verdict)}
          </p>
        ) : null}
        <ul className="mt-3 space-y-2">
          {eligibility.reasons.map((reason) => (
            <li key={reason.ruleId} className="text-sm">
              <span className="font-medium">{reason.label}</span>
              {user ? (
                <span className="block text-xs text-muted-foreground">
                  {reason.detail}
                </span>
              ) : null}
            </li>
          ))}
          {eligibility.reasons.length === 0 ? (
            <li className="text-sm text-muted-foreground">
              The provider reviews eligibility manually.
            </li>
          ) : null}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          {ELIGIBILITY_DISCLAIMER}
        </p>
      </section>

      <section
        aria-labelledby="safety-heading"
        className="mt-8 rounded-3xl bg-amber-50 p-5 dark:bg-amber-400/10"
      >
        <h2
          id="safety-heading"
          className="text-sm font-black uppercase tracking-wide"
        >
          Stay safe
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Confirm every detail on the official source before applying.</li>
          <li>Never pay an unofficial fee to apply.</li>
          <li>No result is guaranteed by Kondo or the provider.</li>
          <li>Report anything suspicious using the report action.</li>
        </ul>
        {opportunity.officialSourceUrl ? (
          <a
            href={opportunity.officialSourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-3 inline-flex text-sm font-bold underline"
          >
            Open the official source
          </a>
        ) : null}
      </section>
    </div>
  );
}
