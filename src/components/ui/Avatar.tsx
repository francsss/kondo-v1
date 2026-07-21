import { cn } from "@/lib/utils";
import { initials, stableGradient } from "@/lib/presentation";
import { MediaImage } from "@/components/ui/MediaImage";

export function Avatar({
  firstName,
  lastName,
  className,
  mediaId,
}: {
  firstName: string;
  lastName: string;
  className?: string;
  mediaId?: string | null;
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
        "inline-grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-black ring-2 ring-card",
        stableGradient(name),
        className,
      )}
      role="img"
    >
      {initials(firstName, lastName)}
    </span>
  );
}
