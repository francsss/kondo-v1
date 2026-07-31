"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

export function ConversationSearch({
  initialQuery,
  archived,
}: {
  initialQuery: string;
  archived: boolean;
}) {
  const router = useRouter();
  const initialRender = useRef(true);
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (archived) params.set("view", "archived");
      const suffix = params.toString();
      router.replace(suffix ? `/messages?${suffix}` : "/messages", {
        scroll: false,
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [archived, query, router]);

  return (
    <div className="group flex h-12 items-center gap-3 rounded-2xl border border-border bg-card px-4 shadow-[0_4px_18px_rgba(13,51,40,0.045)] transition focus-within:border-kondo-green/45 focus-within:ring-4 focus-within:ring-kondo-green/8">
      <Search
        aria-hidden="true"
        className="h-4 w-4 text-muted-foreground transition group-focus-within:text-kondo-green"
      />
      <input
        aria-label="Search conversations"
        className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search conversations"
        type="search"
        value={query}
      />
      {query ? (
        <button
          aria-label="Clear conversation search"
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setQuery("")}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
