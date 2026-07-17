import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { MarketplaceAdminActions } from "@/components/features/admin/MarketplaceAdminActions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MediaImage } from "@/components/ui/MediaImage";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAdminListing } from "@/lib/marketplace";
import { formatPrice } from "@/lib/presentation";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin listing" };
export default async function AdminListingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminPermission("MARKETPLACE_CMS_VIEW");
  const listing = await getAdminListing(user, (await params).id);
  if (!listing) notFound();
  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader description={`${listing.category.name} · ${listing.city.name} · seller ${listing.seller.fullName}`} eyebrow="Marketplace CMS" title={listing.title} />
      <AdminNav currentPath={`/admin/marketplace/${listing.id}`} role={user.role} />
      <div className="mt-6 flex gap-2"><Button asChild size="sm" variant="secondary"><Link href="/admin/marketplace"><ArrowLeft className="h-4 w-4" /> All listings</Link></Button>{listing.status === "ACTIVE" ? <Button asChild size="sm" variant="secondary"><Link href={`/marketplace/${listing.slug}`}>Public view <ExternalLink className="h-4 w-4" /></Link></Button> : null}</div>
      <div className="mt-7 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6"><MarketplaceAdminActions initialReviewed={Boolean(listing.fraudReviewedAt)} initialStatus={listing.status} listingId={listing.id} /><Card><h2 className="font-black text-kondo-ink dark:text-white">Fraud signals</h2><p className="mt-3 text-3xl font-black text-amber-600">{listing.fraudScore}/100</p><div className="mt-3 flex flex-wrap gap-2">{listing.fraudFlags.map((flag) => <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700" key={flag}>{flag}</span>)}</div>{!listing.fraudFlags.length ? <p className="mt-2 text-sm text-slate-400">No automatic flags.</p> : null}</Card></div>
        <div className="space-y-6"><Card><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-3xl font-black text-kondo-green">{formatPrice(listing.priceFen)}</p><p className="mt-1 text-xs text-slate-400">{listing.isNegotiable ? "Negotiable" : "Fixed price"} · {listing._count.favorites} saved</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black dark:bg-white/10">{listing.status}</span></div><p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-slate-300">{listing.description}</p></Card><Card><h2 className="font-black text-kondo-ink dark:text-white">Captured media</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{listing.images.map((image) => image.mediaId ? <MediaImage alt={image.altText ?? listing.title} className="aspect-[4/3] w-full rounded-2xl object-cover" height={480} key={image.id} mediaId={image.mediaId} width={640} /> : <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-slate-100 text-xs text-slate-400 dark:bg-white/5" key={image.id}>Legacy image unavailable</div>)}</div></Card><Card><h2 className="font-black text-kondo-ink dark:text-white">Seller</h2><p className="mt-3 font-bold">{listing.seller.fullName}</p><p className="text-xs text-slate-400">{listing.seller.email}</p></Card></div>
      </div>
    </div>
  );
}
