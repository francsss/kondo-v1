"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpenText,
  Building2,
  CircleHelp,
  Clock,
  Globe2,
  GraduationCap,
  Loader2,
  MapPin,
  MessageSquareText,
  Search,
  ShoppingBag,
  Target,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * The mobile search surface.
 *
 * The navbar has room for an icon, not a field, so the field moves here. This
 * is a presentation of Kondo's one search engine — it calls the same
 * `/api/search` route the `/search` page renders from, and every result and
 * the Enter key hand back over to that page. No second index, no second
 * ranking.
 */

const RECENT_SEARCHES_KEY = "kondo:recent-searches";
const RECENT_SEARCHES_LIMIT = 6;

type SearchRow = {
  key: string;
  href: string;
  label: string;
  title: string;
  detail: string;
  icon: React.ReactNode;
};

type SearchPayload = Record<string, unknown[]>;

function readRecentSearches() {
  try {
    const stored = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function toRows(payload: SearchPayload): SearchRow[] {
  const rows: SearchRow[] = [];
  const push = (
    items: unknown[] | undefined,
    label: string,
    icon: React.ReactNode,
    map: (item: Record<string, unknown>) => {
      id: string;
      href: string;
      title: string;
      detail: string;
    },
  ) => {
    for (const item of (items ?? []).slice(0, 3)) {
      const mapped = map(item as Record<string, unknown>);
      rows.push({ key: `${label}:${mapped.id}`, label, icon, ...mapped });
    }
  };

  push(payload.communities, "Community", <Users />, (item) => ({
    id: String(item.id),
    href: `/communities/${String(item.slug)}`,
    title: `${(item.icon as string) ?? "✦"} ${String(item.name)}`,
    detail: `${Number(item.memberCount ?? 0)} members`,
  }));
  push(payload.users, "Person", <Users />, (item) => ({
    id: String(item.id),
    href: `/profile/${String(item.username ?? item.id)}`,
    title:
      `${String(item.firstName ?? "")} ${String(item.lastName ?? "")}`.trim(),
    detail: (item.affiliation as string) ?? "Kondo member",
  }));
  push(payload.organizations, "Organization", <Building2 />, (item) => ({
    id: String(item.id),
    href: `/organizations/${String(item.slug)}`,
    title: String(item.name),
    detail:
      (item.organizationTypeLabel as string) ?? String(item.countryName ?? ""),
  }));
  push(payload.listings, "Marketplace", <ShoppingBag />, (item) => ({
    id: String(item.id),
    href: `/marketplace/${String(item.slug)}`,
    title: String(item.title),
    detail: String(item.cityName ?? ""),
  }));
  push(payload.guides, "Guide", <BookOpenText />, (item) => ({
    id: String(item.id),
    href: `/guides/${String(item.slug)}`,
    title: String(item.title),
    detail: `${Number(item.estimatedMinutes ?? 0)} min read`,
  }));
  push(payload.questions, "Question", <CircleHelp />, (item) => ({
    id: String(item.id),
    href: `/help/${String(item.slug)}`,
    title: String(item.title),
    detail: `${Number(item.answerCount ?? 0)} answers`,
  }));
  push(payload.opportunities, "Opportunity", <Target />, (item) => ({
    id: String(item.id),
    href: `/student-hub/scholarships/${String(item.slug)}`,
    title: String(item.title),
    detail: String(item.provider ?? ""),
  }));
  push(payload.universities, "University", <GraduationCap />, (item) => ({
    id: String(item.id),
    href: `/communities?tab=discover&q=${encodeURIComponent(String(item.name))}`,
    title: String(item.name),
    detail: String(item.cityName ?? ""),
  }));
  push(payload.cities, "City", <MapPin />, (item) => ({
    id: String(item.id),
    href: `/discover/cities/${String(item.slug)}`,
    title: String(item.name),
    detail: String(item.province ?? "Explore city guide"),
  }));
  push(payload.countries, "Country", <Globe2 />, (item) => ({
    id: String(item.id),
    href: `/communities?tab=discover&q=${encodeURIComponent(String(item.name))}`,
    title: `${(item.emoji as string) ?? "🌍"} ${String(item.name)}`,
    detail: String(item.code ?? ""),
  }));
  push(payload.posts, "Post", <MessageSquareText />, (item) => {
    const community = item.community as { slug?: string; name?: string } | null;
    return {
      id: String(item.id),
      href: `/communities/${String(community?.slug ?? "")}?post=${String(item.id)}`,
      title: String(item.title ?? item.content ?? "").slice(0, 70),
      detail: String(community?.name ?? "Community post"),
    };
  });

  return rows;
}

export function MobileSearchOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  // Results are stored with the term that produced them, so a stale response
  // is never shown next to a newer query — and so "still searching" is a
  // derived fact rather than a second piece of state that can disagree.
  const [results, setResults] = useState<{ term: string; rows: SearchRow[] }>({
    term: "",
    rows: [],
  });
  const [recent, setRecent] = useState<string[]>(readRecentSearches);
  const term = query.trim();
  const searchable = term.length >= 2;
  const rows = results.term === term ? results.rows : [];
  const loading = searchable && results.term !== term;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // The overlay covers the page, so the page behind it must not scroll with it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(term)}`,
          { credentials: "include", signal: controller.signal },
        );
        setResults({
          term,
          rows: response.ok
            ? toRows((await response.json()) as SearchPayload)
            : [],
        });
      } catch {
        // An aborted request is the next keystroke, not a failure.
      }
    }, 220);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term]);

  const rememberSearch = useCallback((value: string) => {
    const next = [
      value,
      ...readRecentSearches().filter((item) => item !== value),
    ].slice(0, RECENT_SEARCHES_LIMIT);
    setRecent(next);
    try {
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {
      // A full or blocked storage is not a reason to break search.
    }
  }, []);

  const submit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed.length < 2) return;
      rememberSearch(trimmed);
      onClose();
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    },
    [onClose, rememberSearch, router],
  );

  const allResultsHref = useMemo(
    () => `/search?q=${encodeURIComponent(term)}`,
    [term],
  );

  return (
    <div className="animate-overlay-in fixed inset-0 z-[60] bg-background motion-reduce:animate-none sm:hidden">
      <div
        aria-label="Search Kondo"
        aria-modal="true"
        className="safe-bottom flex h-[var(--visual-viewport-height,100dvh)] flex-col"
        role="dialog"
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-3">
          <form
            className="kondo-field flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-card px-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit(query);
            }}
            role="search"
          >
            <Search
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-kondo-green"
            />
            <input
              aria-label="Search Kondo"
              className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
              enterKeyHint="search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people, communities, opportunities…"
              ref={inputRef}
              // Not `type="search"`: the browser's own clear button would sit
              // beside Kondo's close button as a second, unexplained ✕.
              type="text"
              value={query}
            />
            {loading ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
              />
            ) : null}
          </form>
          <button
            aria-label="Close search"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          {!searchable ? (
            recent.length ? (
              <>
                <p className="px-1 pb-2 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  Recent searches
                </p>
                <div className="space-y-1">
                  {recent.map((item) => (
                    <button
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-muted"
                      key={item}
                      onClick={() => submit(item)}
                      type="button"
                    >
                      <Clock
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                        {item}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="px-6 py-20 text-center">
                <Search
                  aria-hidden="true"
                  className="mx-auto h-7 w-7 text-muted-foreground"
                />
                <p className="mt-3 text-sm font-black text-foreground">
                  One search for your whole student life
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  People, communities, universities, places, opportunities,
                  guides, and marketplace items.
                </p>
              </div>
            )
          ) : rows.length ? (
            <>
              <div className="space-y-1">
                {rows.map((row) => (
                  <Link
                    className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-muted"
                    href={row.href}
                    key={row.key}
                    onClick={() => {
                      rememberSearch(term);
                      onClose();
                    }}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10 [&>svg]:h-[18px] [&>svg]:w-[18px]">
                      {row.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-black uppercase tracking-wider text-kondo-green">
                        {row.label}
                      </span>
                      <span className="mt-0.5 block truncate text-sm font-bold text-foreground">
                        {row.title}
                      </span>
                      {row.detail ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {row.detail}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                ))}
              </div>
              <Link
                className="mt-3 flex min-h-12 items-center justify-center rounded-2xl bg-secondary text-sm font-black text-secondary-foreground"
                href={allResultsHref}
                onClick={() => {
                  rememberSearch(term);
                  onClose();
                }}
              >
                See all results for “{term}”
              </Link>
            </>
          ) : loading ? null : (
            <div className="px-6 py-20 text-center">
              <p className="text-sm font-black text-foreground">
                No match for “{term}”
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try a different name, city, or keyword.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
