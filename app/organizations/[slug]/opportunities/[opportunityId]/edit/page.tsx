import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpportunityEditor } from "@/components/features/opportunities/OpportunityEditor";
import { getOrganizationOpportunityForEdit } from "@/lib/opportunity-management";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Edit opportunity",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function dateTimeInput(value: string | null) {
  return value ? value.slice(0, 16) : "";
}

export default async function EditOrganizationOpportunityPage({
  params,
}: {
  params: Promise<{ slug: string; opportunityId: string }>;
}) {
  const user = await requireUser();
  const { slug, opportunityId } = await params;
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, slug: true, publicName: true },
  });
  if (!organization) notFound();
  const [opportunity, countries, cities, universities] = await Promise.all([
    getOrganizationOpportunityForEdit({
      userId: user.id,
      organizationId: organization.id,
      opportunityId,
    }),
    prisma.country.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 250,
    }),
    prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true, countryId: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.university.findMany({
      where: { isActive: true },
      select: { id: true, name: true, cityId: true },
      orderBy: { name: "asc" },
      take: 600,
    }),
  ]);
  const cover = opportunity.media[0];
  const scholarship = opportunity.scholarshipDetail;
  const job = opportunity.jobDetail;

  return (
    <OpportunityEditor
      cities={cities}
      countries={countries}
      initial={{
        id: opportunity.id,
        lifecycle: opportunity.lifecycle,
        applicationCount: opportunity.applicationCount,
        coverMediaId: cover?.mediaId ?? null,
        type: opportunity.type,
        title: opportunity.title,
        shortDescription: opportunity.shortDescription,
        description: opportunity.description,
        countryId: opportunity.countryId ?? "",
        cityId: opportunity.cityId ?? "",
        universityId: opportunity.universityId ?? "",
        locationLabel: opportunity.locationLabel ?? "",
        workMode: opportunity.workMode,
        degreeLevels: opportunity.degreeLevels.join(", "),
        fieldsOfStudy: opportunity.fieldsOfStudy.join(", "),
        eligibilityCriteria: opportunity.eligibilityRules
          .map(({ publicLabel }) => publicLabel)
          .join("\n"),
        languages: opportunity.languageRequirements
          .map(
            (item) =>
              `${item.language} | ${item.level}${item.certificateType ? ` | ${item.certificateType}` : ""}`,
          )
          .join("\n"),
        fundingType: scholarship?.fundingType ?? "FULLY_FUNDED",
        tuitionCoverage: scholarship?.tuitionCoverage ?? "",
        accommodationCoverage: scholarship?.accommodationCoverage ?? "",
        monthlyStipend:
          scholarship?.monthlyStipendMinor != null
            ? String(scholarship.monthlyStipendMinor / 100)
            : "",
        stipendCurrency: scholarship?.stipendCurrency ?? "CNY",
        employmentType: job?.employmentType ?? "INTERNSHIP",
        experienceLevel: job?.experienceLevel ?? "UNSPECIFIED",
        weeklyHours: job?.weeklyHours ? String(job.weeklyHours) : "",
        salaryMin:
          job?.salaryMinMinor != null ? String(job.salaryMinMinor / 100) : "",
        salaryMax:
          job?.salaryMaxMinor != null ? String(job.salaryMaxMinor / 100) : "",
        salaryCurrency: job?.salaryCurrency ?? "CNY",
        salaryPeriod: job?.salaryPeriod ?? "MONTH",
        paid: job?.paid == null ? "UNSPECIFIED" : job.paid ? "PAID" : "UNPAID",
        technicalSkills: job?.technicalSkills.join(", ") ?? "",
        softSkills: job?.softSkills.join(", ") ?? "",
        benefits: opportunity.benefits
          .map(
            (item) =>
              `${item.type} | ${item.description ?? ""} | ${item.confidence}`,
          )
          .join("\n"),
        requirements: opportunity.requirements.map(
          ({ documentType }) => documentType,
        ),
        questions: opportunity.questions.map(({ label }) => label).join("\n"),
        applicationOpenAt: dateTimeInput(opportunity.applicationOpenAt),
        applicationDeadline: dateTimeInput(opportunity.applicationDeadline),
        rollingApplications: opportunity.rollingApplications,
        expectedDecisionDate: opportunity.expectedDecisionDate ?? "",
        opportunityStartDate: opportunity.opportunityStartDate ?? "",
        opportunityEndDate: opportunity.opportunityEndDate ?? "",
        timezone: opportunity.timezone,
        applicationMethod: opportunity.applicationMethod,
        externalApplicationUrl: opportunity.externalApplicationUrl ?? "",
        applicationEmail: opportunity.applicationEmail ?? "",
        officialSourceUrl: opportunity.officialSourceUrl ?? "",
      }}
      organization={{
        id: organization.id,
        slug: organization.slug,
        name: organization.publicName,
      }}
      universities={universities}
    />
  );
}
