import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  MapPin,
  Sparkles,
} from "lucide-react";
import {
  ExploreIcon,
  exploreAccentStyles,
} from "@/components/features/explore/ExploreIcon";
import type { ExploreCity, ExploreSection } from "@/features/explore/types";

export function CitySectionView({
  city,
  section,
}: {
  city: ExploreCity;
  section: ExploreSection;
}) {
  const styles = exploreAccentStyles[section.accent];

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Link
        className="inline-flex items-center gap-2 text-sm font-black text-slate-500 transition hover:text-kondo-green dark:text-slate-300"
        href={`/explore/${city.slug}`}
      >
        <ArrowLeft className="h-4 w-4" /> Explore {city.name}
      </Link>

      <header
        className={`noise relative mt-5 overflow-hidden rounded-4xl bg-gradient-to-br px-6 py-8 text-white shadow-lift sm:px-10 sm:py-11 lg:px-12 ${styles.gradient}`}
      >
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[46px] border-white/10"
        />
        <div className="relative max-w-3xl">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur">
            <ExploreIcon className="h-6 w-6" name={section.icon} />
          </span>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-white/60">
            {section.eyebrow}
          </p>
          <h1 className="mt-2 text-balance text-4xl font-black tracking-[-0.05em] sm:text-5xl lg:text-6xl">
            {section.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-white/85 sm:text-lg">
            {section.summary}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
            {section.description}
          </p>
        </div>
      </header>

      <nav
        aria-label={`${city.name} guide sections`}
        className="scrollbar-none mt-6 flex gap-2 overflow-x-auto pb-1"
      >
        {city.sections.map((item) => (
          <Link
            aria-current={item.slug === section.slug ? "page" : undefined}
            className={
              item.slug === section.slug
                ? "inline-flex shrink-0 items-center gap-2 rounded-full bg-kondo-ink px-4 py-2.5 text-xs font-black text-white dark:bg-emerald-400 dark:text-kondo-ink"
                : "inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-500 transition hover:border-kondo-green dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            }
            href={`/explore/${city.slug}/${item.slug}`}
            key={item.slug}
          >
            <ExploreIcon className="h-3.5 w-3.5" name={item.icon} />
            {item.shortTitle}
          </Link>
        ))}
      </nav>

      <section className="mt-8 grid gap-5 md:grid-cols-2">
        {section.entries.map((entry) => (
          <article
            className="flex flex-col rounded-4xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(16,24,40,0.04)] dark:border-white/10 dark:bg-[#14201d] sm:p-7"
            id={entry.slug}
            key={entry.id}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className={`text-[10px] font-black uppercase tracking-[0.16em] ${styles.label}`}
                >
                  {entry.category}
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-kondo-ink dark:text-white">
                  {entry.title}
                </h2>
              </div>
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${styles.icon}`}
              >
                <ExploreIcon
                  className="h-[18px] w-[18px]"
                  name={section.icon}
                />
              </span>
            </div>

            {entry.location ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-slate-400">
                <MapPin className="h-3.5 w-3.5" /> {entry.location}
              </p>
            ) : null}
            <p className="mt-4 text-sm leading-7 text-slate-500 dark:text-slate-400">
              {entry.summary}
            </p>

            <ul className="mt-5 space-y-2.5">
              {entry.details.map((detail) => (
                <li
                  className="flex items-start gap-2.5 text-sm leading-6 text-slate-600 dark:text-slate-300"
                  key={detail}
                >
                  <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-kondo-mint text-kondo-green dark:bg-emerald-400/15 dark:text-emerald-300">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                  {detail}
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-6">
              <div className="flex flex-wrap gap-2">
                {entry.tags.map((tag) => (
                  <span
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black text-slate-500 dark:bg-white/5 dark:text-slate-300"
                    key={tag}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex min-h-9 items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
                <span className="text-[11px] font-bold text-slate-400">
                  {entry.status ?? "Profile architecture ready"}
                </span>
                {entry.source ? (
                  <a
                    className="inline-flex shrink-0 items-center gap-1.5 text-xs font-black text-kondo-green hover:underline"
                    href={entry.source.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {entry.source.label} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <article className="rounded-4xl border border-emerald-100 bg-kondo-mint/70 p-6 dark:border-emerald-400/10 dark:bg-emerald-400/10">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
            Student value
          </p>
          <p className="mt-3 text-lg font-black leading-7 text-kondo-ink dark:text-white">
            {section.studentValue}
          </p>
        </article>
        <article className="rounded-4xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-[#14201d]">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            City value
          </p>
          <p className="mt-3 text-lg font-black leading-7 text-kondo-ink dark:text-white">
            {section.cityValue}
          </p>
        </article>
      </section>

      <section className="mt-10 flex flex-col gap-5 rounded-4xl bg-kondo-navy p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-kondo-lime text-kondo-forest">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="font-black">Keep exploring {city.name}</p>
            <p className="mt-1 max-w-xl text-sm leading-6 text-white/60">
              Move between city life, industry, education, and opportunity from
              one connected guide.
            </p>
          </div>
        </div>
        <Link
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-black text-kondo-ink transition hover:bg-kondo-lime"
          href={`/explore/${city.slug}`}
        >
          City overview <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
