import Link from "next/link";
import { ArrowRight, Globe2, MapPin, Sparkles } from "lucide-react";
import {
  ExploreIcon,
  exploreAccentStyles,
} from "@/components/features/explore/ExploreIcon";
import type { ExploreCity } from "@/features/explore/types";

export function CityHubView({ city }: { city: ExploreCity }) {
  const aboutSection = city.sections.find(
    (section) => section.slug === "about",
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <section className="noise relative overflow-hidden rounded-4xl bg-[#0c332d] px-6 py-8 text-white shadow-lift sm:px-10 sm:py-12 lg:min-h-[500px] lg:px-14 lg:py-14">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 h-80 w-80 rounded-full border-[54px] border-white/5"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl"
        />
        <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-kondo-lime">
              <MapPin className="h-3.5 w-3.5" /> {city.eyebrow}
            </div>
            <h1 className="mt-6 max-w-3xl text-balance text-4xl font-black leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              {city.title}
            </h1>
            <p className="mt-5 max-w-2xl text-balance text-lg font-semibold leading-8 text-white/75 sm:text-xl">
              {city.tagline}
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
              {city.description}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                className="inline-flex h-11 items-center gap-2 rounded-full bg-kondo-lime px-5 text-sm font-black text-kondo-forest transition hover:-translate-y-0.5 hover:bg-white"
                href="#city-sections"
              >
                Explore the city <ArrowRight className="h-4 w-4" />
              </Link>
              {aboutSection ? (
                <Link
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 text-sm font-black text-white transition hover:bg-white/20"
                  href={`/explore/${city.slug}/${aboutSection.slug}`}
                >
                  Why Jiaxing
                </Link>
              ) : null}
            </div>
          </div>

          <aside className="rounded-4xl border border-white/10 bg-white/10 p-5 backdrop-blur-md sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.17em] text-kondo-lime">
                  City signal
                </p>
                <p className="mt-1 text-lg font-black">Jiaxing at a glance</p>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-kondo-lime">
                <Globe2 className="h-5 w-5" />
              </span>
            </div>
            <dl className="mt-5 divide-y divide-white/10">
              {city.signals.map((signal) => (
                <div
                  className="grid gap-1 py-3.5 sm:grid-cols-[110px_1fr] sm:gap-4"
                  key={signal.label}
                >
                  <dt className="text-xs font-bold text-white/45">
                    {signal.label}
                  </dt>
                  <dd className="text-sm font-bold text-white/90">
                    {signal.value}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>

      <section className="mt-10" id="city-sections">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
              One city, many entry points
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-kondo-ink dark:text-white sm:text-4xl">
              Find your way into Jiaxing.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            {city.summary}
          </p>
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {city.sections.map((section, index) => {
            const styles = exploreAccentStyles[section.accent];
            return (
              <Link
                className={`group relative overflow-hidden rounded-4xl border border-border bg-card p-6 text-card-foreground shadow-[0_8px_30px_rgba(16,24,40,0.04)] transition duration-300 hover:-translate-y-1 hover:shadow-soft ${index === 0 ? "sm:col-span-2 xl:col-span-1" : ""}`}
                href={`/explore/${city.slug}/${section.slug}`}
                key={section.slug}
              >
                <div
                  aria-hidden="true"
                  className={`absolute -right-12 -top-12 h-36 w-36 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-100 ${styles.glow}`}
                />
                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className={`grid h-12 w-12 place-items-center rounded-2xl ${styles.icon}`}
                    >
                      <ExploreIcon name={section.icon} />
                    </span>
                    <span className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-muted-foreground transition group-hover:border-kondo-green group-hover:bg-kondo-mint group-hover:text-kondo-forest dark:border-white/10">
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </div>
                  <p
                    className={`mt-6 text-[10px] font-black uppercase tracking-[0.16em] ${styles.label}`}
                  >
                    {section.eyebrow}
                  </p>
                  <h3 className="mt-2 text-2xl font-black tracking-[-0.035em] text-kondo-ink dark:text-white">
                    {section.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {section.summary}
                  </p>
                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs dark:border-white/10">
                    <span className="font-bold text-muted-foreground">
                      {section.signal}
                    </span>
                    <span className="font-black text-kondo-green">
                      Open guide
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-12 rounded-4xl bg-kondo-mint/70 p-6 dark:bg-emerald-400/10 sm:p-8 lg:p-10">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-kondo-lime text-kondo-forest">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
              Kondo × Jiaxing
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-kondo-ink dark:text-white">
              A city guide with a purpose.
            </h2>
          </div>
        </div>
        <div className="mt-7 grid gap-4 lg:grid-cols-3">
          {city.impactPoints.map((point, index) => (
            <article
              className="rounded-3xl border border-white/80 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5"
              key={point.title}
            >
              <span className="text-xs font-black text-kondo-green">
                0{index + 1}
              </span>
              <h3 className="mt-3 text-lg font-black text-kondo-ink dark:text-white">
                {point.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {point.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
