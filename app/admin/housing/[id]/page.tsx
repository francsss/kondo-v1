import { notFound } from "next/navigation";
import { HousingAdminActions } from "@/components/features/admin/HousingAdminActions";
import { MediaImage } from "@/components/ui/MediaImage";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/server-auth";

export default async function AdminHousingListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPermission("HOUSING_VIEW");
  const listing = await prisma.housingListing.findUnique({
    where: { id: (await params).id },
    select: {
      id: true,
      title: true,
      shortDescription: true,
      description: true,
      status: true,
      type: true,
      publisherType: true,
      publicLocationLabel: true,
      privateAddress: true,
      monthlyRentMinor: true,
      currency: true,
      accuracyConfirmedAt: true,
      moderationReason: true,
      createdAt: true,
      city: { select: { name: true } },
      publisherUser: {
        select: { firstName: true, lastName: true, email: true },
      },
      publisherOrganization: { select: { publicName: true } },
      media: {
        where: { kind: { not: "PROOF_DOCUMENT" } },
        select: { id: true, mediaId: true, altText: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!listing) notFound();
  return (
    <section className="mx-auto max-w-5xl">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
        Housing review
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {listing.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {listing.publisherOrganization?.publicName ??
              `${listing.publisherUser?.firstName ?? ""} ${listing.publisherUser?.lastName ?? ""}`.trim()}{" "}
            · {listing.city.name}
          </p>
        </div>
        <HousingAdminActions listingId={listing.id} status={listing.status} />
      </div>
      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 overflow-hidden rounded-3xl">
            {listing.media.slice(0, 4).map((media) => (
              <MediaImage
                alt={media.altText}
                className="aspect-[4/3] h-full w-full object-cover"
                height={500}
                key={media.id}
                mediaId={media.mediaId}
                privateMedia
                width={700}
              />
            ))}
          </div>
          <Card>
            <h2 className="font-display text-xl font-black">Public content</h2>
            <p className="mt-3 font-bold">{listing.shortDescription}</p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
              {listing.description}
            </p>
          </Card>
        </div>
        <aside className="space-y-4">
          <Card>
            <h2 className="font-display text-lg font-black">Review facts</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["Status", listing.status.replaceAll("_", " ")],
                ["Type", listing.type.replaceAll("_", " ")],
                ["Public location", listing.publicLocationLabel],
                ["Private address", listing.privateAddress ?? "Not supplied"],
                [
                  "Price",
                  `${listing.currency} ${Math.round(listing.monthlyRentMinor / 100)}/month`,
                ],
                [
                  "Accuracy",
                  listing.accuracyConfirmedAt ? "Confirmed" : "Not confirmed",
                ],
              ].map(([label, value]) => (
                <div className="flex justify-between gap-4" key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </aside>
      </div>
    </section>
  );
}
