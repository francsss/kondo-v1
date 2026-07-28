"use client";

import Image from "next/image";
import { useState } from "react";

export function MediaImage({
  mediaId,
  alt,
  width,
  height,
  className,
  sizes,
  priority = false,
  privateMedia = false,
  fallbackSrc,
}: {
  mediaId: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  privateMedia?: boolean;
  fallbackSrc?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <Image
      alt={alt}
      className={className}
      height={height}
      onError={fallbackSrc ? () => setFailed(true) : undefined}
      priority={priority}
      sizes={sizes}
      src={failed && fallbackSrc ? fallbackSrc : `/api/media/${mediaId}`}
      unoptimized={privateMedia || Boolean(fallbackSrc)}
      width={width}
    />
  );
}
