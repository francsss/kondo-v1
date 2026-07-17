"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function ListingFavoriteButton({
  listingId,
  initialFavorite,
}: {
  listingId: string;
  initialFavorite: boolean;
}) {
  const [favorite, setFavorite] = useState(initialFavorite);

  async function toggle() {
    const next = !favorite;
    setFavorite(next);
    const response = await fetch(`/api/marketplace/${listingId}/favorites`, {
      method: next ? "POST" : "DELETE",
      credentials: "include",
    }).catch(() => null);
    if (!response?.ok) setFavorite(!next);
  }

  return (
    <Button
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={favorite}
      onClick={toggle}
      size="icon"
      type="button"
      variant="secondary"
    >
      <Heart
        className={favorite ? "h-4 w-4 text-rose-500" : "h-4 w-4"}
        fill={favorite ? "currentColor" : "none"}
      />
    </Button>
  );
}
