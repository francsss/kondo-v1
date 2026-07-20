"use client";

import Link from "next/link";
import {
  BookOpenText,
  CircleHelp,
  Loader2,
  MessageSquareText,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatPrice } from "@/lib/presentation";
import { ResultCard } from "./ResultCard";

type Category =
  | "communities"
  | "listings"
  | "guides"
  | "questions"
  | "users"
  | "posts";

const CATEGORY_ICON: Record<Category, React.ReactNode> = {
  communities: <Users />,
  listings: <ShoppingBag />,
  guides: <BookOpenText />,
  questions: <CircleHelp />,
  users: <Users />,
  posts: <MessageSquareText />,
};

function renderItem(category: Category, item: Record<string, unknown>) {
  switch (category) {
    case "communities":
      return (
        <ResultCard
          detail={`${item.memberCount as number} members`}
          href={`/communities/${item.slug}`}
          icon={CATEGORY_ICON.communities}
          key={item.id as string}
          label="Community"
          title={`${(item.icon as string | null) ?? "✦"} ${item.name}`}
        />
      );
    case "listings":
      return (
        <ResultCard
          detail={`${formatPrice(item.priceFen as number)} · ${item.cityName}`}
          href={`/marketplace/${item.slug}`}
          icon={CATEGORY_ICON.listings}
          key={item.id as string}
          label="Marketplace"
          title={item.title as string}
        />
      );
    case "guides":
      return (
        <ResultCard
          detail={`${item.estimatedMinutes as number} min checklist`}
          href={`/guides/${item.slug}`}
          icon={CATEGORY_ICON.guides}
          key={item.id as string}
          label="Guide"
          title={item.title as string}
        />
      );
    case "questions":
      return (
        <ResultCard
          detail={`${item.answerCount as number} answers`}
          href={`/help/${item.slug}`}
          icon={CATEGORY_ICON.questions}
          key={item.id as string}
          label="Question"
          title={item.title as string}
        />
      );
    case "posts": {
      const community = item.community as { slug: string; name: string };
      const author = item.author as { firstName: string };
      return (
        <ResultCard
          detail={`${author.firstName} · ${community.name}`}
          href={`/communities/${community.slug}?post=${item.id}`}
          icon={CATEGORY_ICON.posts}
          key={item.id as string}
          label="Post"
          title={(item.title as string | null) ?? (item.content as string).slice(0, 80)}
        />
      );
    }
    case "users": {
      const user = item as {
        id: string;
        username: string | null;
        firstName: string;
        lastName: string;
        countryEmoji: string | null;
        affiliation: string | null;
      };
      return (
        <Link href={`/profile/${user.username ?? user.id}`} key={user.id}>
          <Card className="flex items-center gap-4 transition hover:-translate-y-0.5 hover:shadow-soft">
            <Avatar firstName={user.firstName} lastName={user.lastName} />
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-kondo-green">
                Student
              </p>
              <h2 className="mt-1 font-bold text-kondo-ink dark:text-white">
                {user.firstName} {user.lastName}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {user.countryEmoji} {user.affiliation}
              </p>
            </div>
          </Card>
        </Link>
      );
    }
  }
}

export function CategoryResults({
  category,
  query,
}: {
  category: Category;
  query: string;
}) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    loadPage(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPage(after: string | null, replace = false) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ q: query, type: category, limit: "12" });
      if (after) params.set("cursor", after);
      const response = await fetch(`/api/search?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Could not load more results.");
      const data = (await response.json()) as {
        items: Record<string, unknown>[];
        nextCursor: string | null;
      };
      setItems((current) => (replace ? data.items : [...current, ...data.items]));
      setCursor(data.nextCursor);
    } catch {
      setError("Could not load more results.");
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        {items.map((item) => renderItem(category, item))}
      </div>
      {!items.length && initialized && !loading ? (
        <Card className="mt-5 py-16 text-center text-sm text-slate-400">
          No more results.
        </Card>
      ) : null}
      {error ? (
        <p className="mt-5 text-center text-sm font-semibold text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {cursor ? (
        <div className="mt-6 flex justify-center">
          <Button
            disabled={loading}
            onClick={() => loadPage(cursor)}
            variant="secondary"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
