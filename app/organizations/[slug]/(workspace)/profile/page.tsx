import { OrganizationProfileForm } from "@/components/organizations/OrganizationProfileForm";
import { requireOrganizationPermission } from "@/lib/organization-permissions";
import { getOrganizationReferenceData } from "@/lib/reference-data";
import { getOrganizationWorkspace } from "@/lib/organization-workspaces";
import { requireUser } from "@/lib/server-auth";

export default async function OrganizationProfilePage({
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
    "ORGANIZATION_EDIT_PROFILE",
  );
  const { countries, cities } = await getOrganizationReferenceData();
  return (
    <div>
      <h2 className="text-2xl font-black tracking-tight">
        Organization profile
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage the professional identity without changing any teammate’s
        personal Kondo profile.
      </p>
      <div className="mt-6">
        <OrganizationProfileForm
          cities={cities.map((city) => ({
            id: city.id,
            name: city.name,
            secondary: [city.province, city.country.name]
              .filter(Boolean)
              .join(" · "),
            countryId: city.countryId,
          }))}
          countries={countries.map((country) => ({
            id: country.id,
            name: `${country.emoji ?? ""} ${country.name}`.trim(),
          }))}
          organization={workspace.organization}
        />
      </div>
    </div>
  );
}
