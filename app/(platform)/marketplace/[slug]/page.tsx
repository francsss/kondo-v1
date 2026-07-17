import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Edit3, MapPin } from "lucide-react";
import { MessageUserButton } from "@/components/features/messages/MessageUserButton";
import { ListingFavoriteButton } from "@/components/features/marketplace/ListingFavoriteButton";
import { ListingReportButton } from "@/components/features/marketplace/ListingReportButton";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MediaImage } from "@/components/ui/MediaImage";
import { formatPrice } from "@/lib/presentation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export default async function ListingDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const listing = await prisma.marketplaceListing.findFirst({
    where: {
      slug,
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
      category: { isActive: true },
    },
    include: {
      category: true,
      city: true,
      seller: { select: { id: true, firstName: true, lastName: true, country: { select: { emoji: true } }, university: { select: { shortName: true } } } },
      images: { where: { mediaId: { not: null } }, orderBy: { order: "asc" }, select: { id: true, mediaId: true, altText: true } },
      _count: { select: { favorites: true } },
      favorites: { where: { userId: user.id }, select: { id: true } },
    },
  });
  if (!listing) notFound();
  const owner = listing.sellerId === user.id;
  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16">
      <Button asChild size="sm" variant="ghost"><Link href="/marketplace"><ChevronLeft className="h-4 w-4" /> Back to marketplace</Link></Button>
      <div className="mt-4 grid gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className={`grid gap-3 ${listing.images.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {listing.images.length ? listing.images.map((image, index) => image.mediaId ? <MediaImage alt={image.altText ?? listing.title} className={`h-full w-full rounded-4xl object-cover shadow-soft ${index === 0 && listing.images.length > 2 ? "sm:col-span-2 aspect-[16/9]" : "aspect-[4/3]"}`} height={900} key={image.id} mediaId={image.mediaId} priority={index === 0} sizes="(min-width: 1024px) 60vw, 100vw" width={1200} /> : null) : <div className="grid aspect-[4/3] place-items-center rounded-4xl bg-kondo-mint text-9xl">{listing.category.icon ?? "📦"}</div>}
        </div>
        <div>
          <div className="flex items-center justify-between"><span className="rounded-full bg-kondo-mint px-3 py-1.5 text-xs font-black text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300">{listing.category.name}</span><ListingFavoriteButton initialFavorite={listing.favorites.length > 0} listingId={listing.id} /></div>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] text-kondo-ink dark:text-white sm:text-4xl">{listing.title}</h1>
          <p className="mt-3 text-3xl font-black text-kondo-forest dark:text-emerald-300">{formatPrice(listing.priceFen)} {listing.isNegotiable ? <span className="text-sm font-bold text-slate-400">negotiable</span> : null}</p>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-400"><MapPin className="h-4 w-4" /> {listing.city.name}</p>
          <p className="mt-6 whitespace-pre-line text-sm leading-7 text-slate-600 dark:text-slate-300">{listing.description}</p>
          <Card className="mt-6 flex items-center gap-3 p-4"><Avatar firstName={listing.seller.firstName} lastName={listing.seller.lastName} /><div className="min-w-0 flex-1"><p className="font-bold text-kondo-ink dark:text-white">{listing.seller.firstName} {listing.seller.lastName}</p><p className="truncate text-xs text-slate-400">{listing.seller.country?.emoji} {listing.seller.university?.shortName ?? "Kondo member"}</p></div></Card>
          {owner ? <Button asChild className="mt-5 w-full" variant="secondary"><Link href={`/marketplace/${listing.slug}/edit`}><Edit3 className="h-4 w-4" /> Edit your listing</Link></Button> : <MessageUserButton className="mt-5 w-full" currentUserId={user.id} label="Chat with seller" sourceId={listing.id} sourceType="MARKETPLACE_LISTING" userId={listing.seller.id} />}
          <p className="mt-3 text-center text-xs leading-5 text-slate-400">Meet in a public place. Kondo never handles payment or asks for a deposit.</p>
          {!owner ? <ListingReportButton listingId={listing.id} /> : null}
        </div>
      </div>
    </div>
  );
}
