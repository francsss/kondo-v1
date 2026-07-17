import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpenText,
  CircleHelp,
  MessageSquareText,
  Search,
  ShoppingBag,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { formatPrice } from "@/lib/presentation";
import { searchKondo } from "@/lib/platform-queries";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const user = await requireUser();
  const results = await searchKondo(q, user.id);
  const total = Object.values(results).reduce(
    (count, items) => count + items.length,
    0,
  );
  return (
    <div className="mx-auto max-w-[1040px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16">
      <form
        className="flex h-16 items-center gap-4 rounded-3xl border border-slate-200 bg-white px-5 shadow-soft dark:border-white/10 dark:bg-[#14201d]"
        role="search"
      >
        <Search className="h-5 w-5 text-kondo-green" />
        <input
          autoFocus
          className="w-full bg-transparent text-lg font-semibold text-kondo-ink outline-none placeholder:font-normal placeholder:text-slate-400 dark:text-white"
          defaultValue={q}
          name="q"
          placeholder="Search all of Kondo"
        />
        <kbd className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-400 dark:border-white/10 dark:bg-white/5">
          Enter
        </kbd>
      </form>
      {q.length < 2 ? (
        <div className="py-24 text-center">
          <Search className="mx-auto h-9 w-9 text-slate-300" />
          <h1 className="mt-4 text-xl font-black text-kondo-ink dark:text-white">
            One search for your whole student life
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Find people, communities, answers, guides, posts, and marketplace
            items.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-7 flex items-end justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-kondo-green">
                Search results
              </p>
              <h1 className="mt-1 text-2xl font-black text-kondo-ink dark:text-white">
                “{q}”
              </h1>
            </div>
            <p className="text-sm text-slate-400">{total} results</p>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {results.communities.map((item) => (
              <ResultCard
                href={`/communities/${item.slug}`}
                icon={<Users />}
                key={item.id}
                label="Community"
                title={`${item.icon ?? "✦"} ${item.name}`}
                detail={`${item.memberCount} members`}
              />
            ))}
            {results.guides.map((item) => (
              <ResultCard
                href={`/guides/${item.slug}`}
                icon={<BookOpenText />}
                key={item.id}
                label="Guide"
                title={item.title}
                detail={`${item.estimatedMinutes} min checklist`}
              />
            ))}
            {results.listings.map((item) => (
              <ResultCard
                href={`/marketplace/${item.slug}`}
                icon={<ShoppingBag />}
                key={item.id}
                label="Marketplace"
                title={item.title}
                detail={`${formatPrice(item.priceFen)} · ${item.cityName}`}
              />
            ))}
            {results.questions.map((item) => (
              <ResultCard
                href={`/help/${item.slug}`}
                icon={<CircleHelp />}
                key={item.id}
                label="Question"
                title={item.title}
                detail={`${item.answerCount} answers`}
              />
            ))}
            {results.posts.map((item) => (
              <ResultCard
                detail={`${item.author.firstName} · ${item.community.name}`}
                href={`/communities/${item.community.slug}?post=${item.id}`}
                icon={<MessageSquareText />}
                key={item.id}
                label="Post"
                title={item.title ?? item.content.slice(0, 80)}
              />
            ))}
            {results.users.map((item) => (
              <Link href={`/profile/${item.username ?? item.id}`} key={item.id}>
                <Card className="flex items-center gap-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                  <Avatar firstName={item.firstName} lastName={item.lastName} />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-kondo-green">
                      Student
                    </p>
                    <h2 className="mt-1 font-bold text-kondo-ink dark:text-white">
                      {item.firstName} {item.lastName}
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.countryEmoji} {item.affiliation}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ResultCard({
  href,
  icon,
  label,
  title,
  detail,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <Link href={href}>
      <Card className="flex h-full items-center gap-4 transition hover:-translate-y-0.5 hover:shadow-soft">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10 [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </span>
        <span>
          <span className="text-[10px] font-black uppercase tracking-wider text-kondo-green">
            {label}
          </span>
          <span className="mt-1 block font-bold text-kondo-ink dark:text-white">
            {title}
          </span>
          <span className="mt-1 block text-xs text-slate-400">{detail}</span>
        </span>
      </Card>
    </Link>
  );
}
