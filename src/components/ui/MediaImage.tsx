import Image from "next/image";

export function MediaImage({
  mediaId,
  alt,
  width,
  height,
  className,
  sizes,
  priority = false,
  privateMedia = false,
}: {
  mediaId: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  privateMedia?: boolean;
}) {
  return (
    <Image
      alt={alt}
      className={className}
      height={height}
      priority={priority}
      sizes={sizes}
      src={`/api/media/${mediaId}`}
      unoptimized={privateMedia}
      width={width}
    />
  );
}
