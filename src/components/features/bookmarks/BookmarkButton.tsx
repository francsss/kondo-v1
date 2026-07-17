"use client";

import { Bookmark } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type BookmarkButtonProps = {
  targetType: "POST" | "LISTING" | "GUIDE" | "QUESTION";
  targetId: string;
  initialBookmarked?: boolean;
  iconOnly?: boolean;
  className?: string;
};

export function BookmarkButton({
  targetType,
  targetId,
  initialBookmarked,
  iconOnly = false,
  className,
}: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked ?? false);
  const [loading, setLoading] = useState(initialBookmarked === undefined);
  const endpoint = `/api/bookmarks/${targetType}/${targetId}`;

  useEffect(() => {
    if (initialBookmarked !== undefined) return;
    let active = true;
    fetch(endpoint)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data) setBookmarked(Boolean(data.bookmarked));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [endpoint, initialBookmarked]);

  async function toggle() {
    const nextBookmarked = !bookmarked;
    setBookmarked(nextBookmarked);
    setLoading(true);
    const response = await fetch(endpoint, {
      method: nextBookmarked ? "PUT" : "DELETE",
    }).catch(() => null);
    if (!response?.ok) setBookmarked(!nextBookmarked);
    setLoading(false);
  }

  return (
    <Button
      aria-label={bookmarked ? "Remove bookmark" : "Save bookmark"}
      aria-pressed={bookmarked}
      className={className}
      disabled={loading}
      onClick={toggle}
      size={iconOnly ? "icon" : "sm"}
      type="button"
      variant="ghost"
    >
      <Bookmark
        aria-hidden="true"
        className="h-4 w-4"
        fill={bookmarked ? "currentColor" : "none"}
      />
      {iconOnly ? null : bookmarked ? "Saved" : "Save"}
    </Button>
  );
}
