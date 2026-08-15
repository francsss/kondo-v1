import Link from "next/link";
import { OrganizationProfileForm } from "@/components/organizations/OrganizationProfileForm";
import { OrganizationVisibilityPanel } from "@/components/organizations/OrganizationVisibilityPanel";
import { hasOrganizationPermission } from "@/lib/organization-authorization";
import { getOrganizationPublicationReadiness } from "@/lib/organization-publication";
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
  const readiness = await getOrganizationPublicationReadiness(
    workspace.organization.id,
  );
  return (
    <div>
      <h2 className="text-2xl font-black tracking-tight">
        Organization profile
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage the professional identity without changing any teammate’s
        personal Kondo profile.
      </p>

      {/*
       * Profile is now the single home for the organization's identity, so the
       * state of the public page belongs here rather than behind a second
       * navigation entry that described the same thing.
       */}
      <div className="mt-5">
        <OrganizationVisibilityPanel
          state={{
            slug: workspace.organization.slug,
            publicProfileStatus: workspace.organization.publicProfileStatus,
            missing: readiness.missingRequirements,
            blocking: readiness.blockingReasons,
            canPublish: hasOrganizationPermission(
              {
                role: workspace.membership.storedRole,
                status: workspace.membership.status,
              },
              "ORGANIZATION_MANAGE_PUBLICATION",
            ),
          }}
        />
        <Link
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground transition hover:text-kondo-green"
          href={`/organizations/${workspace.organization.slug}/public-profile`}
        >
          Manage public page, media and publication →
        </Link>
      </div>
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
