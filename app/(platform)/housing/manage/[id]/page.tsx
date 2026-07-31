import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, ImageIcon, MessageCircle, ShieldCheck } from "lucide-react";
import { HousingManageActions } from "@/components/features/housing/HousingManageActions";
import { Card } from "@/components/ui/Card";
import { listHousingInquiries } from "@/lib/housing-inquiries";
import { assertHousingListingOwner } from "@/lib/housing-permissions";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Housing listing workspace" };

export default async function HousingListingWorkspace({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const id = (await params).id;
  await assertHousingListingOwner({ userId: user.id, listingId: id });
  const [listing, inquiries] = await Promise.all([
    prisma.housingListing.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        status: true,
        moderationReason: true,
        accuracyConfirmedAt: true,
        version: true,
        updatedAt: true,
        expiresAt: true,
        city: { select: { name: true } },
        media: {
          select: { id: true, kind: true, isCover: true },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { savedBy: true, inquiries: true } },
      },
    }),
    listHousingInquiries({ actorId: user.id, listingId: id }),
  ]);
  if (!listing) notFound();
  const hasPublicImage = listing.media.some(
    (media) => media.kind !== "PROOF_DOCUMENT",
  );
  const readiness = [
    {
      label: "Accuracy confirmed",
      complete: Boolean(listing.accuracyConfirmedAt),
    },
    { label: "At least one public image", complete: hasPublicImage },
    { label: "Location and price saved", complete: true },
  ];
  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Link
        className="text-sm font-bold text-muted-foreground hover:text-foreground"
        href="/housing/manage"
      >
        ← All listings
      </Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-5">
        <div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-black">
            {listing.status.replaceAll("_", " ")}
          </span>
          <h1 className="mt-3 font-display text-3xl font-black">
            {listing.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {listing.city.name} · Updated{" "}
            {listing.updatedAt.toLocaleDateString("en")}
          </p>
        </div>
        {listing.status === "PUBLISHED" ? (
          <Link
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-bold hover:bg-muted"
            href={`/housing/listings/${listing.slug}`}
          >
            <Eye className="h-4 w-4" /> View public page
          </Link>
        ) : null}
      </div>
      {listing.moderationReason ? (
        <Card className="mt-6 border-destructive/25 bg-destructive/5">
          <p className="font-bold text-destructive">Review feedback</p>
          <p className="mt-2 text-sm leading-6">{listing.moderationReason}</p>
        </Card>
      ) : null}
      <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card>
            <h2 className="font-display text-xl font-black">
              Publication status
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {listing.shortDescription}
            </p>
            <div className="mt-5">
              <HousingManageActions
                listingId={listing.id}
                status={listing.status}
              />
            </div>
          </Card>
          <Card>
            <h2 className="font-display text-xl font-black">Performance</h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-muted/50 p-4">
                <MessageCircle className="h-5 w-5 text-kondo-green" />
                <p className="mt-2 text-2xl font-black">
                  {listing._count.inquiries}
                </p>
                <p className="text-xs text-muted-foreground">Inquiries</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-4">
                <ShieldCheck className="h-5 w-5 text-kondo-green" />
                <p className="mt-2 text-2xl font-black">
                  {listing._count.savedBy}
                </p>
                <p className="text-xs text-muted-foreground">Saves</p>
              </div>
            </div>
          </Card>
          {inquiries.length ? (
            <Card>
              <h2 className="font-display text-xl font-black">
                Your inquiries
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Only inquiries routed directly to your Kondo account appear
                here. Organization members do not share private conversations.
              </p>
              <div className="mt-4 space-y-2">
                {inquiries.slice(0, 10).map((inquiry) => {
                  const content = (
                    <>
                      <span className="font-bold">
                        {inquiry.requester.firstName}{" "}
                        {inquiry.requester.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {inquiry.topic.toLowerCase().replaceAll("_", " ")}
                      </span>
                    </>
                  );
                  return inquiry.conversationId ? (
                    <Link
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-3 text-sm transition hover:bg-muted/45"
                      href={`/messages/${inquiry.conversationId}`}
                      key={inquiry.id}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-3 text-sm"
                      key={inquiry.id}
                    >
                      {content}
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}
        </div>
        <aside>
          <Card>
            <h2 className="font-display text-lg font-black">
              Ready to submit?
            </h2>
            <ul className="mt-4 space-y-3">
              {readiness.map((item) => (
                <li
                  className="flex items-center gap-3 text-sm"
                  key={item.label}
                >
                  <span
                    aria-hidden
                    className={`h-2.5 w-2.5 rounded-full ${item.complete ? "bg-kondo-green" : "bg-muted-foreground/35"}`}
                  />
                  {item.label}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
              {listing.media.length} attached files
            </div>
          </Card>
        </aside>
      </div>
    </main>
  );
}
