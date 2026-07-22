import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  GraduationCap,
  Search,
} from "lucide-react";
import { ScholarshipActions } from "@/components/features/student-hub/ScholarshipActions";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Scholarships" };

export default async function ScholarshipsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; funding?: string; saved?: string }>;
}) {
  const user = await requireUser();
  const { q = "", funding, saved } = await searchParams;
  const scholarships = await prisma.scholarship.findMany({
    where: {
      isActive: true,
      ...(funding ? { fundingType: funding as "FULL" | "PARTIAL" } : {}),
      ...(saved ? { favorites: { some: { userId: user.id } } } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { provider: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      university: { select: { name: true } },
      favorites: { where: { userId: user.id }, select: { status: true } },
    },
    orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
  });
  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-kondo-green">
          Scholarships
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
          Funding opportunities, without the noise.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Verified opportunities can be saved and tracked from discovery to
          decision.
        </p>
      </div>
      <Card className="mt-7">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <label className="flex h-11 items-center gap-3 rounded-2xl border border-border px-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              aria-label="Search scholarships"
              className="w-full bg-transparent text-sm outline-none"
              defaultValue={q}
              name="q"
              placeholder="University, city or scholarship"
            />
          </label>
          <select
            className="h-11 rounded-2xl border border-border bg-background px-3 text-sm"
            defaultValue={funding ?? ""}
            name="funding"
          >
            <option value="">All funding types</option>
            <option value="FULL">Full funding</option>
            <option value="PARTIAL">Partial funding</option>
          </select>
          <button className="h-11 rounded-full bg-kondo-ink px-6 text-sm font-black text-white dark:bg-emerald-400 dark:text-kondo-ink">
            Filter
          </button>
        </form>
        <div className="mt-3">
          <Link
            className="text-xs font-black text-kondo-green"
            href={
              saved
                ? "/student-hub/scholarships"
                : "/student-hub/scholarships?saved=1"
            }
          >
            {saved ? "Show all opportunities" : "Show saved opportunities"}
          </Link>
        </div>
      </Card>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {scholarships.map((item) => (
          <Card className="flex h-full flex-col" key={item.id}>
            <div className="flex items-start justify-between gap-4">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300">
                <GraduationCap className="h-5 w-5" />
              </span>
              <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-black uppercase tracking-wide">
                {item.fundingType.replaceAll("_", " ")}
              </span>
            </div>
            <h2 className="mt-5 text-lg font-black">{item.title}</h2>
            <p className="mt-1 text-sm font-bold text-kondo-green">
              {item.provider}
            </p>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
              {item.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{item.university?.name ?? "Multiple universities"}</span>
              {item.city ? <span>· {item.city}</span> : null}
              {item.deadline ? (
                <span className="inline-flex items-center gap-1">
                  · <CalendarDays className="h-3.5 w-3.5" />
                  {item.deadline.toLocaleDateString()}
                </span>
              ) : null}
            </div>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
              <ScholarshipActions
                id={item.id}
                initialStatus={item.favorites[0]?.status ?? null}
              />
              <a
                className="inline-flex items-center gap-1 text-sm font-black text-kondo-green"
                href={item.applicationUrl}
                rel="noreferrer"
                target="_blank"
              >
                Official page <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </Card>
        ))}
      </section>
      {!scholarships.length ? (
        <Card className="mt-6 py-16 text-center">
          <GraduationCap className="mx-auto h-9 w-9 text-kondo-green" />
          <h2 className="mt-4 text-xl font-black">
            No opportunity matches this view yet.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Administrators can add verified scholarships without placeholder
            data.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
