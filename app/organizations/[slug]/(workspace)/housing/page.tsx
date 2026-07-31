import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { listManagedHousingListings } from "@/lib/housing-listings";
import { getOrganizationWorkspace } from "@/lib/organization-workspaces";
import { requireUser } from "@/lib/server-auth";

export default async function OrganizationHousingWorkspace({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const workspace = await getOrganizationWorkspace(
    user.id,
    (await params).slug,
  );
  const result = await listManagedHousingListings({
    userId: user.id,
    organizationId: workspace.organization.id,
    pageSize: 50,
  });
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
            Organization capability
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">Housing</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Publish managed residences and handle student inquiries through a
            designated Kondo representative.
          </p>
        </div>
        <Button asChild>
          <Link
            href={`/housing/create?organizationId=${workspace.organization.id}`}
          >
            <Plus className="h-4 w-4" /> New organization listing
          </Link>
        </Button>
      </div>
      <div className="mt-6 space-y-3">
        {result.listings.map((listing) => (
          <Link
            className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 transition hover:border-foreground/20 sm:flex-row sm:items-center sm:justify-between"
            href={`/housing/manage/${listing.id}`}
            key={listing.id}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black">{listing.title}</h3>
                <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-black">
                  {listing.status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {listing.city.name} · {listing._count.inquiries} inquiries ·{" "}
                {listing._count.savedBy} saves
              </p>
            </div>
            <p className="font-black text-kondo-green">
              {listing.currency} {Math.round(listing.monthlyRentMinor / 100)}
              /month
            </p>
          </Link>
        ))}
        {!result.listings.length ? (
          <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            This organization has not created a Housing listing yet.
          </div>
        ) : null}
      </div>
    </section>
  );
}
