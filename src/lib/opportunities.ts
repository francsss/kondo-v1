import type { Prisma } from "@prisma/client";
import { resolveApplicationWindow } from "@/lib/opportunity-application-window";
import {
  canExposeOpportunityPublicly,
  publicOpportunityWhere,
} from "@/lib/opportunity-visibility";
import { opportunityTypeDefinition } from "@/lib/opportunity-types";
import { isHttpWebsiteUrl } from "@/lib/website-url";
import { prisma } from "@/lib/prisma";

/**
 * Opportunity reads and public serialization.
 *
 * Route handlers never return raw Prisma records. Everything public goes
 * through the DTO builders here, which are the only place that decides what an
 * anonymous visitor may see. Applicant data, internal notes, reviewer identity,
 * moderation notes and raw media keys are structurally absent from these
 * projections rather than filtered out later.
 */

export class OpportunityError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "OpportunityError";
  }
}

/** Compact projection for cards, search results and rails. */
export const opportunityCardSelect = {
  id: true,
  slug: true,
  type: true,
  lifecycle: true,
  title: true,
  shortDescription: true,
  workMode: true,
  locationLabel: true,
  applicationMethod: true,
  applicationOpenAt: true,
  applicationDeadline: true,
  rollingApplications: true,
  timezone: true,
  expiresAt: true,
  publishedAt: true,
  publicationBlockedAt: true,
  publisherType: true,
  externalUrlBlockedAt: true,
  country: { select: { id: true, name: true } },
  city: { select: { id: true, name: true } },
  university: { select: { id: true, name: true } },
  publisherOrganization: {
    select: {
      id: true,
      slug: true,
      publicName: true,
      lifecycleStatus: true,
      publicProfileStatus: true,
      publicProfileBlockedAt: true,
      verificationStatus: true,
      isOfficialPartner: true,
    },
  },
  scholarshipAgent: {
    select: {
      id: true,
      slug: true,
      name: true,
      isActive: true,
      verified: true,
    },
  },
  scholarshipDetail: {
    select: {
      fundingType: true,
      monthlyStipendMinor: true,
      stipendCurrency: true,
    },
  },
  jobDetail: {
    select: {
      employmentType: true,
      salaryMinMinor: true,
      salaryMaxMinor: true,
      salaryCurrency: true,
      salaryPeriod: true,
      paid: true,
    },
  },
  media: {
    where: { isCover: true },
    select: { mediaId: true, altText: true },
    take: 1,
  },
} satisfies Prisma.OpportunitySelect;

/** Full projection for the public opportunity page. */
export const opportunityDetailSelect = {
  ...opportunityCardSelect,
  description: true,
  officialSourceUrl: true,
  externalApplicationUrl: true,
  applicationEmail: true,
  expectedDecisionDate: true,
  opportunityStartDate: true,
  opportunityEndDate: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  degreeLevels: { select: { degreeLevel: true } },
  fieldsOfStudy: { select: { fieldKey: true } },
  languageRequirements: {
    select: {
      id: true,
      language: true,
      level: true,
      certificateType: true,
      required: true,
    },
  },
  eligibilityRules: {
    select: {
      id: true,
      ruleType: true,
      operator: true,
      structuredValue: true,
      required: true,
      publicLabel: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: "asc" },
  },
  benefits: {
    select: {
      id: true,
      type: true,
      amountMinor: true,
      currency: true,
      period: true,
      description: true,
      confidence: true,
    },
    orderBy: { sortOrder: "asc" },
  },
  requirements: {
    select: {
      id: true,
      documentType: true,
      required: true,
      description: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: "asc" },
  },
  questions: {
    select: {
      id: true,
      type: true,
      label: true,
      description: true,
      required: true,
      options: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: "asc" },
  },
  scholarshipDetail: true,
  jobDetail: true,
} satisfies Prisma.OpportunitySelect;

type CardRow = Prisma.OpportunityGetPayload<{
  select: typeof opportunityCardSelect;
}>;
type DetailRow = Prisma.OpportunityGetPayload<{
  select: typeof opportunityDetailSelect;
}>;

function publisherDto(row: CardRow) {
  if (row.publisherType === "ORGANIZATION" && row.publisherOrganization) {
    const organization = row.publisherOrganization;
    return {
      kind: "ORGANIZATION" as const,
      name: organization.publicName,
      href:
        organization.publicProfileStatus === "PUBLISHED" &&
        !organization.publicProfileBlockedAt
          ? `/organizations/${organization.slug}`
          : null,
      verified: organization.verificationStatus === "VERIFIED",
      officialPartner: organization.isOfficialPartner,
    };
  }
  if (
    row.publisherType === "LEGACY_SCHOLARSHIP_AGENT" &&
    row.scholarshipAgent
  ) {
    return {
      kind: "SCHOLARSHIP_AGENT" as const,
      name: row.scholarshipAgent.name,
      href: `/student-hub/scholarships/agents`,
      verified: row.scholarshipAgent.verified,
      officialPartner: false,
    };
  }
  return {
    kind: "EDITORIAL" as const,
    name: "Kondo",
    href: null,
    verified: true,
    officialPartner: false,
  };
}

/**
 * Compensation and funding summaries never invent a value. When the publisher
 * did not provide one, the summary is null and the UI renders an explicit
 * "not specified" instead of a fabricated range.
 */
function compensationSummary(row: CardRow): string | null {
  if (row.scholarshipDetail) {
    const labels: Record<string, string> = {
      FULLY_FUNDED: "Fully funded",
      PARTIALLY_FUNDED: "Partially funded",
      TUITION_ONLY: "Tuition covered",
      STIPEND_ONLY: "Stipend only",
      FEE_WAIVER: "Fee waiver",
      OTHER: "Funding available",
    };
    return labels[row.scholarshipDetail.fundingType] ?? null;
  }
  const job = row.jobDetail;
  if (!job) return null;
  if (job.paid === false) return "Unpaid";
  if (job.salaryMinMinor === null || !job.salaryCurrency) return null;
  const period = job.salaryPeriod ? ` / ${job.salaryPeriod.toLowerCase()}` : "";
  const min = (job.salaryMinMinor / 100).toLocaleString();
  if (job.salaryMaxMinor && job.salaryMaxMinor !== job.salaryMinMinor) {
    const max = (job.salaryMaxMinor / 100).toLocaleString();
    return `${job.salaryCurrency} ${min}–${max}${period}`;
  }
  return `${job.salaryCurrency} ${min}${period}`;
}

export function serializeOpportunityCard(row: CardRow, now = new Date()) {
  const definition = opportunityTypeDefinition(row.type);
  const window = resolveApplicationWindow({
    lifecycle: row.lifecycle,
    applicationMethod: row.applicationMethod,
    applicationOpenAt: row.applicationOpenAt,
    applicationDeadline: row.applicationDeadline,
    rollingApplications: row.rollingApplications,
    timezone: row.timezone,
    now,
  });
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    typeLabel: definition.label,
    category: definition.category,
    title: row.title,
    summary: row.shortDescription,
    href: `/opportunities/${row.slug}`,
    workMode: row.workMode,
    location:
      row.locationLabel ??
      [row.city?.name, row.country?.name].filter(Boolean).join(", ") ??
      null,
    university: row.university?.name ?? null,
    publisher: publisherDto(row),
    compensationSummary: compensationSummary(row),
    coverMediaId: row.media[0]?.mediaId ?? null,
    coverAltText: row.media[0]?.altText ?? null,
    applicationWindow: {
      state: window.state,
      deadline: window.deadline?.toISOString() ?? null,
      timezone: window.timezone,
      rolling: window.rolling,
      acceptsKondoApplications: window.acceptsKondoApplications,
      redirectsExternally: window.redirectsExternally,
    },
  };
}

export type PublicOpportunityCard = ReturnType<typeof serializeOpportunityCard>;

export function serializeOpportunityDetail(row: DetailRow, now = new Date()) {
  const card = serializeOpportunityCard(row, now);
  // A blocked external source suppresses the outbound action entirely, and any
  // URL that is not plain http(s) is never emitted.
  const externalUrlSafe =
    !row.externalUrlBlockedAt &&
    typeof row.externalApplicationUrl === "string" &&
    isHttpWebsiteUrl(row.externalApplicationUrl);

  return {
    ...card,
    description: row.description,
    officialSourceUrl:
      row.officialSourceUrl && isHttpWebsiteUrl(row.officialSourceUrl)
        ? row.officialSourceUrl
        : null,
    applicationMethod: row.applicationMethod,
    externalApplicationUrl: externalUrlSafe ? row.externalApplicationUrl : null,
    applicationEmail:
      row.applicationMethod === "EMAIL" ? row.applicationEmail : null,
    dates: {
      opensAt: row.applicationOpenAt?.toISOString() ?? null,
      deadline: row.applicationDeadline?.toISOString() ?? null,
      expectedDecisionDate:
        row.expectedDecisionDate?.toISOString().slice(0, 10) ?? null,
      startDate: row.opportunityStartDate?.toISOString().slice(0, 10) ?? null,
      endDate: row.opportunityEndDate?.toISOString().slice(0, 10) ?? null,
      timezone: row.timezone,
      rolling: row.rollingApplications,
    },
    degreeLevels: row.degreeLevels.map(({ degreeLevel }) => degreeLevel),
    fieldsOfStudy: row.fieldsOfStudy.map(({ fieldKey }) => fieldKey),
    languageRequirements: row.languageRequirements,
    eligibilityCriteria: row.eligibilityRules.map((rule) => ({
      id: rule.id,
      label: rule.publicLabel,
      required: rule.required,
      ruleType: rule.ruleType,
    })),
    benefits: row.benefits.map((benefit) => ({
      id: benefit.id,
      type: benefit.type,
      description: benefit.description,
      confidence: benefit.confidence,
      amount:
        benefit.amountMinor !== null && benefit.currency
          ? {
              value: benefit.amountMinor / 100,
              currency: benefit.currency,
              period: benefit.period,
            }
          : null,
    })),
    requirements: row.requirements,
    questions: row.questions.map((question) => ({
      id: question.id,
      type: question.type,
      label: question.label,
      description: question.description,
      required: question.required,
      options: question.options,
    })),
    scholarship: row.scholarshipDetail
      ? {
          fundingType: row.scholarshipDetail.fundingType,
          tuitionCoverage: row.scholarshipDetail.tuitionCoverage,
          accommodationCoverage: row.scholarshipDetail.accommodationCoverage,
          monthlyStipend:
            row.scholarshipDetail.monthlyStipendMinor !== null &&
            row.scholarshipDetail.stipendCurrency
              ? {
                  value: row.scholarshipDetail.monthlyStipendMinor / 100,
                  currency: row.scholarshipDetail.stipendCurrency,
                }
              : null,
          insuranceCoverage: row.scholarshipDetail.insuranceCoverage,
          travelCoverage: row.scholarshipDetail.travelCoverage,
          nominationRequired: row.scholarshipDetail.nominationRequired,
          targetPrograms: row.scholarshipDetail.targetPrograms,
          intakeLabel: row.scholarshipDetail.intakeLabel,
          studyLanguage: row.scholarshipDetail.studyLanguage,
          durationLabel: row.scholarshipDetail.durationLabel,
          renewalConditions: row.scholarshipDetail.renewalConditions,
        }
      : null,
    job: row.jobDetail
      ? {
          employmentType: row.jobDetail.employmentType,
          roleTitle: row.jobDetail.roleTitle,
          department: row.jobDetail.department,
          experienceLevel: row.jobDetail.experienceLevel,
          weeklyHours: row.jobDetail.weeklyHours,
          durationLabel: row.jobDetail.durationLabel,
          paid: row.jobDetail.paid,
          // Only rendered when explicitly declared by the publisher.
          visaSupport: row.jobDetail.visaSupport,
          housingSupport: row.jobDetail.housingSupport,
          conversionPotential: row.jobDetail.conversionPotential,
          numberOfOpenings: row.jobDetail.numberOfOpenings,
          technicalSkills: row.jobDetail.technicalSkills,
          softSkills: row.jobDetail.softSkills,
          salaryNegotiable: row.jobDetail.salaryNegotiable,
        }
      : null,
  };
}

export type PublicOpportunityDetail = ReturnType<
  typeof serializeOpportunityDetail
>;

export async function getPublicOpportunityBySlug(
  slug: string,
  options: { now?: Date } = {},
) {
  const row = await prisma.opportunity.findFirst({
    where: { slug, ...publicOpportunityWhere({ scope: "HISTORICAL" }) },
    select: opportunityDetailSelect,
  });
  if (!row) return null;
  const visible = canExposeOpportunityPublicly({
    lifecycle: row.lifecycle,
    publisherType: row.publisherType,
    publicationBlockedAt: row.publicationBlockedAt,
    expiresAt: row.expiresAt,
    organizationLifecycleStatus:
      row.publisherOrganization?.lifecycleStatus ?? null,
    organizationPublicProfileBlockedAt:
      row.publisherOrganization?.publicProfileBlockedAt ?? null,
    legacyAgentActive: row.scholarshipAgent?.isActive ?? null,
    scope: "HISTORICAL",
    now: options.now,
  });
  if (!visible) return null;
  return serializeOpportunityDetail(row, options.now);
}

export async function listPublicOpportunityIdsForSitemap(limit = 5000) {
  return prisma.opportunity.findMany({
    where: publicOpportunityWhere(),
    select: { slug: true, updatedAt: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
}
