import { redirect } from "next/navigation";
import { resolveSignedInLanding } from "@/lib/onboarding-routing";
import { getOrganizationOnboardingMemberships } from "@/lib/organizations";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function OnboardingRouterPage() {
  const user = await requireUser();
  const organizationMemberships = await getOrganizationOnboardingMemberships(
    user.id,
  );
  redirect(resolveSignedInLanding({ ...user, organizationMemberships }));
}
