import { cn } from "@/lib/utils";

/**
 * A catalogue entry always has a cover, even before anyone uploads artwork:
 * a partner image when one is published, otherwise a deterministic tint drawn
 * from the slug so the shelf reads as designed rather than as missing images.
 */
/**
 * Jacket tones for titles with no artwork yet.
 *
 * These were five shades of the Kondo green, which turned a shelf of covers
 * into one green wall — the brand shouting over the thing it is selling.
 * Green stays in the set, as one book among several, and the rest read like
 * cloth bindings so the grid looks like a shelf.
 */
const TINTS = [
  "from-kondo-forest to-kondo-green",
  "from-slate-700 to-slate-500",
  "from-amber-800 to-amber-600",
  "from-indigo-800 to-indigo-600",
  "from-rose-900 to-rose-700",
  "from-teal-800 to-cyan-700",
  "from-stone-700 to-stone-500",
] as const;

function tintFor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100_000;
  }
  return TINTS[hash % TINTS.length];
}

export function StudyEssentialCover({
  slug,
  title,
  imageUrl,
  coverEmoji,
  className,
  emojiClassName = "text-5xl",
  priority = false,
}: {
  slug: string;
  title: string;
  imageUrl?: string | null;
  coverEmoji?: string | null;
  className?: string;
  emojiClassName?: string;
  /** Above-the-fold covers should not wait for the lazy-load threshold. */
  priority?: boolean;
}) {
  if (imageUrl) {
    return (
      <span className={cn("block overflow-hidden bg-muted", className)}>
        {/* Partner artwork is an absolute URL on the partner's own host. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className="h-full w-full object-cover"
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          loading={priority ? "eager" : "lazy"}
          src={imageUrl}
        />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "grid place-items-center bg-gradient-to-br",
        tintFor(slug),
        className,
      )}
    >
      <span aria-hidden="true" className={emojiClassName}>
        {coverEmoji ?? "📘"}
      </span>
      <span className="sr-only">{title}</span>
    </span>
  );
}
