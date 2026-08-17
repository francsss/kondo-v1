import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  Check,
  CircleHelp,
  Globe2,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { KondoLogo } from "@/components/KondoLogo";
import { JourneyShowcase } from "@/components/marketing/JourneyShowcase";
import { Reveal } from "@/components/marketing/Reveal";
import { Button } from "@/components/ui/Button";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

export const metadata: Metadata = {
  title: "The digital ecosystem for international students in China",
  description:
    "Meet your community, find trusted answers, shop locally, and settle into student life in China with confidence.",
};

const features = [
  {
    icon: Users,
    eyebrow: "Community",
    title: "Find your people",
    description:
      "University, city, country, and topic communities where the advice actually fits your life.",
    color:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
  },
  {
    icon: BookOpenText,
    eyebrow: "Student guides",
    title: "Know what comes next",
    description:
      "Short, practical checklists for arrival, residence permits, Alipay, healthcare, and more.",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  },
  {
    icon: ShoppingBag,
    eyebrow: "Marketplace",
    title: "Buy from students nearby",
    description:
      "Find rooms, bicycles, books, furniture, and devices—without in-app payment or hidden fees.",
    color:
      "bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300",
  },
  {
    icon: CircleHelp,
    eyebrow: "Help center",
    title: "Get answers that are lived",
    description:
      "Ask the community, learn from students who solved it, and highlight the answers that work.",
    color: "bg-sky-100 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300",
  },
];

export default function LandingPage() {
  return (
    <main className="overflow-hidden bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <KondoLogo />
          <nav
            aria-label="Marketing navigation"
            className="hidden items-center gap-8 text-sm font-bold text-muted-foreground md:flex"
          >
            <a
              className="transition hover:text-kondo-forest dark:hover:text-emerald-300"
              href="#why-kondo"
            >
              Why Kondo
            </a>
            <a
              className="transition hover:text-kondo-forest dark:hover:text-emerald-300"
              href="#inside"
            >
              Inside Kondo
            </a>
            <a
              className="transition hover:text-kondo-forest dark:hover:text-emerald-300"
              href="#trust"
            >
              Safety
            </a>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              asChild
              className="h-9 px-3 text-xs sm:h-11 sm:px-5 sm:text-sm"
              variant="ghost"
            >
              <Link
                data-product-event={PRODUCT_EVENTS.LOGIN_CLICKED}
                data-product-source="landing_header"
                href="/login"
              >
                Login
              </Link>
            </Button>
            <Button
              asChild
              className="h-9 px-3 text-xs sm:px-4 sm:text-sm"
              size="sm"
            >
              <Link
                data-product-event={PRODUCT_EVENTS.JOIN_CLICKED}
                data-product-source="landing_header"
                href="/register"
              >
                <span className="sm:hidden">Join</span>
                <span className="hidden sm:inline">Join Kondo</span>
                <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="noise relative px-5 pb-20 pt-28 sm:px-8 sm:pb-32 sm:pt-48">
        <div
          aria-hidden="true"
          className="absolute left-[8%] top-28 h-72 w-72 rounded-full bg-kondo-lime/30 blur-3xl dark:bg-lime-600/10"
        />
        <div
          aria-hidden="true"
          className="absolute right-[4%] top-52 h-80 w-80 rounded-full bg-emerald-200/50 blur-3xl dark:bg-emerald-700/10"
        />
        <div className="relative mx-auto max-w-7xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-3 py-1.5 text-xs font-black text-kondo-forest shadow-sm backdrop-blur dark:border-emerald-400/15 dark:bg-white/5 dark:text-emerald-300">
            <Globe2 className="h-3.5 w-3.5" /> Built with international students
            in China
          </div>
          <h1 className="mx-auto mt-5 max-w-5xl text-balance text-[2.6rem] font-black leading-[0.98] tracking-[-0.065em] sm:mt-7 sm:text-7xl lg:text-[88px]">
            Find your people.
            <br />
            <span className="text-kondo-green">Find your way.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-base leading-8 text-muted-foreground sm:mt-8 sm:text-lg">
            The digital ecosystem for international students in China — before,
            during and after your studies.
          </p>
          {/*
           * One obvious next step. "See the journey" is deliberately quiet: it
           * scrolls, it does not compete, and the page still makes sense to
           * someone who ignores it entirely.
           */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row">
            <Button asChild size="lg">
              <Link
                data-product-event={PRODUCT_EVENTS.JOIN_CLICKED}
                data-product-source="landing_hero"
                href="/register"
              >
                Join Kondo <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <a href="#journey">See the journey</a>
            </Button>
          </div>
          <p className="mt-6 text-xs font-semibold text-muted-foreground">
            Free for students · No payments · Privacy by design
          </p>

          <div className="relative mx-auto mt-10 max-w-6xl rounded-[32px] sm:mt-16 border border-slate-200 bg-white/80 p-2 shadow-[0_40px_100px_rgba(20,71,58,0.18)] backdrop-blur dark:border-white/10 dark:bg-white/5 sm:p-3">
            <div className="overflow-hidden rounded-[24px] bg-[#f7f7f3] text-left dark:bg-[#111c19]">
              <div className="flex h-14 items-center gap-4 border-b border-border bg-card px-4 text-card-foreground sm:px-6">
                <KondoLogo href="#" size="sm" />
                <div className="mx-auto hidden h-9 w-full max-w-sm items-center gap-2 rounded-full bg-slate-100 px-4 text-xs text-muted-foreground sm:flex dark:bg-white/5">
                  <Search className="h-3.5 w-3.5" /> Search Kondo
                </div>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-orange-400 text-[10px] font-black text-amber-950">
                  AM
                </span>
              </div>
              <div className="grid min-h-[530px] sm:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[210px_minmax(0,1fr)_270px]">
                <aside className="hidden border-r border-border bg-card p-4 text-card-foreground sm:block">
                  <div className="space-y-1">
                    {[
                      ["Home", "🏡"],
                      ["Communities", "🌍"],
                      ["Marketplace", "🛍️"],
                      ["Student guides", "🧭"],
                      ["Help center", "💬"],
                    ].map(([label, icon], index) => (
                      <div
                        className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold ${index === 0 ? "bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300" : "text-muted-foreground"}`}
                        key={label}
                      >
                        <span>{icon}</span>
                        {label}
                      </div>
                    ))}
                  </div>
                  <div className="mt-36 rounded-2xl bg-kondo-navy p-3 text-white">
                    <p className="text-[10px] font-black">Make Kondo yours</p>
                    <p className="mt-1 text-[9px] leading-4 text-white/50">
                      Complete your profile for better recommendations.
                    </p>
                  </div>
                </aside>
                <div className="p-4 sm:p-6">
                  <p className="text-[10px] font-black text-kondo-green">
                    TUESDAY, JULY 14
                  </p>
                  <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
                    Welcome back, Ama 👋🏾
                  </h2>
                  <div className="mt-4 rounded-2xl bg-gradient-to-r from-kondo-navy to-kondo-forest p-4 text-white">
                    <p className="text-[9px] font-black uppercase tracking-wider text-kondo-lime">
                      Next on your checklist
                    </p>
                    <p className="mt-1 text-sm font-black">
                      Your first 72 hours in China
                    </p>
                    <div className="mt-3 h-1 rounded-full bg-white/15">
                      <div className="h-full w-[64%] rounded-full bg-kondo-lime" />
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-card-foreground">
                    <div className="flex gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-200 to-fuchsia-400 text-[10px] font-black text-violet-950">
                        KN
                      </span>
                      <div>
                        <p className="text-xs font-black">
                          Kwame N.{" "}
                          <span className="font-normal text-muted-foreground">
                            · 2h
                          </span>
                        </p>
                        <p className="mt-1 text-[10px] font-bold text-kondo-green">
                          🎓 Tsinghua Community
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm font-black">
                      Where do you buy a student metro card?
                    </p>
                    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                      The office near the east gate now accepts passports. Go
                      before 4 PM and bring your admission letter...
                    </p>
                    <div className="mt-4 flex gap-4 border-t border-slate-100 pt-3 text-[10px] font-bold text-muted-foreground dark:border-white/10">
                      <span>♡ 28</span>
                      <span>◯ 12</span>
                      <span className="ml-auto">⌑</span>
                    </div>
                  </div>
                </div>
                <aside className="hidden border-l border-slate-200 bg-white/60 p-5 dark:border-white/10 dark:bg-white/[0.02] lg:block">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Upcoming near you
                  </p>
                  <div className="mt-4 space-y-4">
                    {[
                      ["JUL 18", "Beijing student mixer"],
                      ["JUL 22", "New arrivals Q&A"],
                      ["JUL 27", "Campus football day"],
                    ].map(([date, title]) => (
                      <div className="flex gap-3" key={title}>
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-100 text-center text-[8px] font-black text-orange-700">
                          {date}
                        </span>
                        <div>
                          <p className="text-[11px] font-bold">{title}</p>
                          <p className="mt-0.5 text-[9px] text-muted-foreground">
                            Beijing
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-8 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Your communities
                  </p>
                  <div className="mt-3 space-y-3">
                    {[
                      ["🇬🇭", "Ghanaians in China"],
                      ["🏙️", "Beijing Students"],
                      ["🎓", "Tsinghua University"],
                    ].map(([icon, label]) => (
                      <div
                        className="flex items-center gap-2 text-[10px] font-bold"
                        key={label}
                      >
                        <span className="grid h-8 w-8 place-items-center rounded-xl bg-kondo-mint dark:bg-emerald-400/10">
                          {icon}
                        </span>
                        {label}
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/*
       * The strip that stood here counted "+ 200 countries and regions", which
       * is not a number Kondo can stand behind. What is true is who it is
       * built for, so that is what it says now.
       */}
      <section className="border-y border-border bg-card py-10 text-card-foreground sm:py-12">
        <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
          <p className="text-balance text-lg font-black tracking-[-0.03em] sm:text-2xl">
            Built for international students in China, wherever they came from.
          </p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Kondo is free for students, takes no payment in the marketplace, and
            keeps your profile private by default.
          </p>
        </div>
      </section>

      <section
        className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32"
        id="journey"
      >
        <Reveal className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
            The whole way through
          </p>
          <h2 className="mt-4 text-balance text-4xl font-black tracking-[-0.05em] sm:text-6xl">
            One app for the years,
            <br />
            not just the arrival.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Studying abroad is three different problems in a row. Kondo is built
            around that arc rather than around a feature list.
          </p>
        </Reveal>
        <Reveal className="mt-14">
          <JourneyShowcase />
        </Reveal>
      </section>

      <section
        className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32"
        id="inside"
      >
        <Reveal className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
            One app. The useful parts.
          </p>
          <h2 className="mt-4 text-balance text-4xl font-black tracking-[-0.05em] sm:text-6xl">
            Less searching. Less guessing.
            <br />
            More living.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Kondo brings the parts of student life that usually live across
            group chats, old documents, and word of mouth into one calm, trusted
            place.
          </p>
        </Reveal>
        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {features.map(
            ({ icon: Icon, eyebrow, title, description, color }) => (
              <article
                className="group rounded-4xl border border-border bg-card p-7 text-card-foreground transition duration-300 hover:-translate-y-1 hover:shadow-lift sm:p-9"
                key={title}
              >
                <span
                  className={`grid h-12 w-12 place-items-center rounded-2xl ${color}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-7 text-xs font-black uppercase tracking-wider text-kondo-green">
                  {eyebrow}
                </p>
                <h3 className="mt-2 text-2xl font-black tracking-tight">
                  {title}
                </h3>
                <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
                  {description}
                </p>
                <span className="mt-7 inline-flex items-center gap-2 text-sm font-black text-kondo-forest transition group-hover:gap-3 dark:text-emerald-300">
                  Explore <ArrowRight className="h-4 w-4" />
                </span>
              </article>
            ),
          )}
        </div>
      </section>

      <section
        className="bg-kondo-navy px-5 py-24 text-white sm:px-8 sm:py-32"
        id="trust"
      >
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-kondo-lime">
              <ShieldCheck className="h-4 w-4" /> Trust is a product feature
            </div>
            <h2 className="mt-6 text-balance text-4xl font-black tracking-[-0.05em] sm:text-6xl">
              Built to feel safe from day one.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/60">
              Clear identity, useful moderation, privacy-aware profiles, and
              marketplace guidance help the community protect itself without
              making Kondo feel cold.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              "No integrated payments",
              "Role-based moderation",
              "Privacy-first profiles",
              "Useful notifications only",
              "Report and audit foundations",
              "Secure session management",
            ].map((item) => (
              <div
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold"
                key={item}
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-kondo-lime text-kondo-forest">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 sm:py-32" id="why-kondo">
        <div className="noise mx-auto max-w-6xl overflow-hidden rounded-[40px] bg-gradient-to-br from-kondo-mint via-emerald-100 to-kondo-lime/70 p-8 text-center dark:from-emerald-950/40 dark:via-[#16251f] dark:to-lime-950/20 sm:p-16">
          <Sparkles className="mx-auto h-7 w-7 text-kondo-green" />
          <h2 className="mx-auto mt-5 max-w-3xl text-balance text-4xl font-black tracking-[-0.05em] sm:text-6xl">
            Arrive with questions.
            <br />
            Never face them alone.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
            Join the growing ecosystem for international students building their
            lives, studies, and friendships in China.
          </p>
          <Button asChild className="mt-8" size="lg">
            <Link
              data-product-event={PRODUCT_EVENTS.JOIN_CLICKED}
              data-product-source="landing_footer"
              href="/register"
            >
              Join Kondo for free <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-slate-200 px-5 py-10 dark:border-white/10 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <KondoLogo />
            <p className="mt-3 text-xs text-muted-foreground">
              The digital ecosystem for international students in China.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-xs font-bold text-muted-foreground">
            <Link href="/about">About</Link>
            <Link href="/guidelines">Guidelines</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <span>© 2026 Kondo</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
