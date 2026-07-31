import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpportunityApplicationWizard } from "@/components/features/opportunities/OpportunityApplicationWizard";
import { getPublicOpportunityBySlug } from "@/lib/opportunities";
import { listUserOpportunityDocuments } from "@/lib/opportunity-documents";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Apply",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function OpportunityApplyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const opportunity = await getPublicOpportunityBySlug((await params).slug);
  if (!opportunity || !opportunity.applicationWindow.acceptsKondoApplications) {
    notFound();
  }

  const [documents, professionalProfile] = await Promise.all([
    listUserOpportunityDocuments(user.id),
    prisma.userOpportunityProfile.findUnique({ where: { userId: user.id } }),
  ]);

  return (
    <OpportunityApplicationWizard
      opportunity={opportunity}
      initialDocuments={documents}
      applicant={{
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        country: user.country?.name ?? null,
        city: user.city?.name ?? null,
        university: user.university?.name ?? null,
        studyLevel: user.studyLevel,
        degree: user.degree,
      }}
      initialProfessionalProfile={{
        skills: professionalProfile?.skills ?? [],
        professionalInterests: professionalProfile?.professionalInterests ?? [],
        portfolioUrl: professionalProfile?.portfolioUrl ?? "",
        professionalProfileUrl:
          professionalProfile?.professionalProfileUrl ?? "",
        workAuthorizationNote: professionalProfile?.workAuthorizationNote ?? "",
      }}
    />
  );
}
