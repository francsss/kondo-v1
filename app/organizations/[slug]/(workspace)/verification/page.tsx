import { OrganizationVerificationFlow } from "@/components/organizations/OrganizationVerificationFlow";
import { requireOrganizationPermission } from "@/lib/organization-permissions";
import { getOrganizationVerificationState } from "@/lib/organization-verification";
import { getOrganizationWorkspace } from "@/lib/organization-workspaces";
import { getOrganizationReferenceData } from "@/lib/reference-data";
import { requireUser } from "@/lib/server-auth";

export default async function OrganizationVerificationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const workspace = await getOrganizationWorkspace(
    user.id,
    (await params).slug,
  );
  await requireOrganizationPermission(
    user.id,
    { id: workspace.organization.id },
    "ORGANIZATION_MANAGE_VERIFICATION",
  );
  const [verification, reference] = await Promise.all([
    getOrganizationVerificationState(user.id, workspace.organization.id),
    getOrganizationReferenceData(),
  ]);
  return (
    <div>
      <h2 className="text-2xl font-black tracking-tight">
        Organization verification
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A confidential human review, separate from official Kondo partnership.
      </p>
      <div className="mt-6">
        <OrganizationVerificationFlow
          countries={reference.countries.map((country) => ({
            id: country.id,
            name: `${country.emoji ?? ""} ${country.name}`.trim(),
          }))}
          initialVerification={verification}
          organization={workspace.organization}
        />
      </div>
    </div>
  );
}
