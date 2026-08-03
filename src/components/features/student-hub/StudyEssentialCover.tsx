import { cn } from "@/lib/utils";

/**
 * A catalogue entry always has a cover, even before anyone uploads artwork:
 * a partner image when one is published, otherwise a deterministic tint drawn
 * from the slug so the shelf reads as designed rather than as missing images.
 */
const TINTS = [
  "from-kondo-forest to-kondo-green",
  "from-emerald-600 to-teal-500",
  "from-teal-700 to-emerald-500",
  "from-green-700 to-lime-500",
  "from-emerald-800 to-emerald-500",
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
}: {
  slug: string;
  title: string;
  imageUrl?: string | null;
  coverEmoji?: string | null;
  className?: string;
  emojiClassName?: string;
}) {
  if (imageUrl) {
    return (
      <span
        className={cn("block overflow-hidden bg-muted", className)}
      >
        {/* Partner artwork is an absolute URL on the partner's own host. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
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
