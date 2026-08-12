import { ProductCard } from "@/components/features/commerce/ProductCard";
import { StudyEssentialCover } from "@/components/features/student-hub/StudyEssentialCover";
import { formatEssentialPrice } from "@/lib/study-essentials";

/**
 * A Study Essentials entry on the shared commerce card.
 *
 * It uses the same geometry as a Marketplace listing so the two feel like one
 * product, and then diverges where the content demands it: covers are portrait
 * because books are, and the price line is replaced by ownership once the
 * member has the title. Showing a price to someone who already paid it is the
 * kind of detail that makes a store feel like it is not paying attention.
 */
export function StudyEssentialCard({
  item,
  owned = false,
  priority = false,
}: {
  item: {
    id: string;
    slug: string;
    title: string;
    priceMinor: number | null;
    currency: string;
    format: string;
    source: string;
    coverEmoji: string | null;
    imageUrl: string | null;
    providerName: string | null;
  };
  owned?: boolean;
  priority?: boolean;
}) {
  const price = formatEssentialPrice(item.priceMinor, item.currency);
  const digital = item.format === "DIGITAL";

  return (
    <ProductCard
      badges={
        owned
          ? [{ label: "In library", tone: "accent" as const }]
          : [{ label: digital ? "Digital" : "Physical" }]
      }
      footer={item.providerName ?? "Published by Kondo"}
      href={
        // An owned digital title opens where the member left it; everything
        // else goes to the catalogue entry.
        owned && digital
          ? `/student-hub/essentials/read/${item.slug}`
          : `/student-hub/essentials/${item.slug}`
      }
      media={{
        ratio: "portrait",
        node: (
          <StudyEssentialCover
            className="h-full w-full"
            coverEmoji={item.coverEmoji}
            emojiClassName="text-5xl"
            imageUrl={item.imageUrl}
            priority={priority}
            slug={item.slug}
            title={item.title}
          />
        ),
      }}
      price={
        owned ? (
          <span className="text-kondo-forest dark:text-emerald-300">
            {digital ? "Open book" : "In your library"}
          </span>
        ) : (
          (price ?? "See provider")
        )
      }
      secondary={owned ? undefined : digital ? "Digital" : "Physical"}
      title={item.title}
    />
  );
}
