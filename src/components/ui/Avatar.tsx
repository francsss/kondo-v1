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
          "inline-grid h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-2 ring-white dark:bg-white/5 dark:ring-[#14201d]",
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
        "inline-grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-black ring-2 ring-white dark:ring-[#14201d]",
        stableGradient(name),
        className,
      )}
      role="img"
    >
      {initials(firstName, lastName)}
    </span>
  );
}
