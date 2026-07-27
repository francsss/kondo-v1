import { cn } from "@/lib/utils";
import { defaultAvatarDataUri, initials } from "@/lib/presentation";
import { MediaImage } from "@/components/ui/MediaImage";

export function Avatar({
  firstName,
  lastName,
  className,
  mediaId,
  seed,
}: {
  firstName: string;
  lastName: string;
  className?: string;
  mediaId?: string | null;
  seed?: string;
}) {
  const name = `${firstName} ${lastName}`;
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
          height={192}
          mediaId={mediaId}
          privateMedia
          width={192}
        />
      </span>
    );
  }
  return (
    <span
      aria-label={name}
      className={cn(
        "inline-grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cover bg-center text-xs font-black ring-2 ring-card",
        className,
      )}
      role="img"
      style={{
        backgroundImage: `url("${defaultAvatarDataUri(firstName, lastName, seed)}")`,
      }}
    >
      <span className="sr-only">{initials(firstName, lastName)}</span>
    </span>
  );
}
