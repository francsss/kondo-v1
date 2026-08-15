import { cn } from "@/lib/utils";
import { initials } from "@/lib/presentation";
import { defaultAvatarFor } from "@/lib/default-avatars";
import { MediaImage } from "@/components/ui/MediaImage";

/**
 * A face for every student, always.
 *
 * There are three cases and the component handles all of them in one place, so
 * no page has to think about it:
 *
 *   uploaded photo            → the photo
 *   no photo                  → one of the five Kondo defaults, chosen from a
 *                               stable seed so it never changes underfoot
 *   photo that fails to load  → the same default, via `MediaImage`'s fallback
 *
 * The default is resolved, never stored. That is what makes it work for
 * accounts that existed long before these drawings did, with no backfill and
 * no chance of a generated image being mistaken for something the student
 * chose — and it means an upload always wins.
 */
export function Avatar({
  firstName,
  lastName,
  className,
  mediaId,
  seed,
  priority = false,
}: {
  firstName: string;
  lastName: string;
  className?: string;
  mediaId?: string | null;
  /**
   * Stable identity for picking the default — a user ID. Falling back to the
   * name keeps it deterministic when no ID is to hand, though two people
   * called the same thing will then share a face.
   */
  seed?: string;
  priority?: boolean;
}) {
  const name = `${firstName} ${lastName}`.trim();
  const fallback = defaultAvatarFor(seed || name || "kondo");

  if (mediaId) {
    return (
      <span
        aria-label={name}
        className={cn(
          "inline-grid h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-card",
          className,
        )}
        role="img"
      >
        <MediaImage
          alt={`Portrait of ${name}`}
          className="h-full w-full object-cover"
          fallbackSrc={fallback.src}
          height={192}
          mediaId={mediaId}
          priority={priority}
          privateMedia
          width={192}
        />
      </span>
    );
  }

  /*
   * A background image rather than an <img>: the element is already sized by
   * its class, so there is no intrinsic dimension to reflow around and nothing
   * shifts as the list paints. The file is a shared, cacheable SVG, so a
   * hundred rows cost one request between them.
   */
  return (
    <span
      aria-label={name || `Kondo ${fallback.label} avatar`}
      className={cn(
        "inline-grid h-10 w-10 shrink-0 rounded-full bg-muted bg-cover bg-center ring-2 ring-card",
        className,
      )}
      role="img"
      style={{ backgroundImage: `url("${fallback.src}")` }}
    >
      <span className="sr-only">{initials(firstName, lastName)}</span>
    </span>
  );
}
