import type { Metadata } from "next";
import type { Prisma, ScholarshipStatus } from "@prisma/client";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { ScholarshipActions } from "@/components/features/student-hub/ScholarshipActions";
import { ScholarshipFilters } from "@/components/features/student-hub/ScholarshipFilters";
import { ScholarshipNav } from "@/components/features/student-hub/ScholarshipNav";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { effectiveScholarshipStatus } from "@/lib/scholarships";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Scholarships" };

const studyLevels = [
  "LANGUAGE",
  "BACHELORS",
  "MASTERS",
  "DOCTORATE",
  "EXCHANGE",
  "OTHER",
] as const;

function statusWhere(status: string | undefined) {
  const now = new Date();
  if (status === "CLOSED") {
    return {
      OR: [
        { status: "CLOSED" as ScholarshipStatus },
        { closesAt: { lt: now } },
      ],
    };
  }
  if (status === "OPENING_SOON") {
    return {
      OR: [
        { status: "OPENING_SOON" as ScholarshipStatus },
        { opensAt: { gt: now } },
      ],
      AND: [{ OR: [{ closesAt: null }, { closesAt: { gte: now } }] }],
    };
  }
  if (status === "OPEN") {
    return {
      status: "OPEN" as ScholarshipStatus,
      OR: [{ opensAt: null }, { opensAt: { lte: now } }],
      AND: [{ OR: [{ closesAt: null }, { closesAt: { gte: now } }] }],
    };
  }
  return {};
}

function remainingLabel(closesAt: Date | null) {
  if (!closesAt) return "No fixed deadline";
  const days = Math.ceil(
    (closesAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  if (days < 0) return "Deadline passed";
  if (days === 0) return "Closes today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

export default async function ScholarshipsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    funding?: string;
    saved?: string;
    country?: string;
    university?: string;
    level?: string;
    field?: string;
    status?: string;
  }>;
}) {
  const user = await requireUser();
  const {
    q = "",
    funding,
    saved,
    country,
    university,
    level,
    field,
    status,
  } = await searchParams;
  const where: Prisma.ScholarshipWhereInput = {
    isActive: true,
    ...(funding === "FULL" || funding === "PARTIAL"
      ? { fundingType: funding }
      : {}),
    ...(saved ? { favorites: { some: { userId: user.id } } } : {}),
    ...(country ? { countryId: country } : {}),
    ...(university
      ? { universities: { some: { universityId: university } } }
      : {}),
    ...(level && studyLevels.includes(level as (typeof studyLevels)[number])
      ? { studyLevels: { has: level as (typeof studyLevels)[number] } }
      : {}),
    ...(field ? { fields: { has: field } } : {}),
    AND: [
      statusWhere(status),
      q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { provider: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
              { fields: { has: q } },
            ],
          }
        : {},
    ],
  };
  const [scholarships, countries, universities, fieldRows] = await Promise.all([
    prisma.scholarship.findMany({
      where,
      include: {
        country: { select: { name: true } },
        universities: {
          include: { university: { select: { name: true } } },
        },
        favorites: { where: { userId: user.id }, select: { status: true } },
      },
      orderBy: [
        { isFeatured: "desc" },
        { closesAt: { sort: "asc", nulls: "last" } },
        { createdAt: "desc" },
      ],
    }),
    prisma.country.findMany({
      where: { isActive: true, scholarships: { some: { isActive: true } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.university.findMany({
      where: {
        isActive: true,
        scholarshipLinks: { some: { scholarship: { isActive: true } } },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.scholarship.findMany({
      where: { isActive: true },
      select: { fields: true },
    }),
  ]);
  const fields = [...new Set(fieldRows.flatMap((item) => item.fields))].sort();
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
          Discover verified opportunities, understand every requirement, and
          track your application from preparation to decision.
        </p>
      </div>
      <ScholarshipNav active="opportunities" />
      <ScholarshipFilters
        options={{
          countries: countries.map((item) => ({
            id: item.id,
            name: item.name,
          })),
          universities: universities.map((item) => ({
            id: item.id,
            name: item.name,
          })),
          levels: studyLevels.map((item) => ({
            id: item,
            name: `${item[0]}${item.slice(1).toLowerCase()}`,
          })),
          fields: fields.map((item) => ({ id: item, name: item })),
          funding: [
            { id: "FULL", name: "Full funding" },
            { id: "PARTIAL", name: "Partial funding" },
          ],
          statuses: [
            { id: "OPEN", name: "Open" },
            { id: "OPENING_SOON", name: "Opening soon" },
            { id: "CLOSED", name: "Closed" },
          ],
        }}
        saved={Boolean(saved)}
        values={{ q, country, university, level, field, funding, status }}
      />
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {scholarships.map((item) => {
          const effectiveStatus = effectiveScholarshipStatus(item);
          const linkedUniversities = item.universities.map(
            ({ university: linked }) => linked.name,
          );
          return (
            <Card className="group flex h-full flex-col" key={item.id}>
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300">
                  <GraduationCap className="h-5 w-5" />
                </span>
                <div className="flex flex-wrap justify-end gap-2">
                  {item.isFeatured ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
                      <Sparkles className="h-3 w-3" />
                      Featured
                    </span>
                  ) : null}
                  <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-black uppercase tracking-wide">
                    {effectiveStatus.replaceAll("_", " ")}
                  </span>
                </div>
              </div>
              <h2 className="mt-5 text-lg font-black">{item.title}</h2>
              <p className="mt-1 flex items-center gap-1 text-sm font-bold text-kondo-green">
                {item.provider}
                {item.lastVerifiedAt ? (
                  <BadgeCheck
                    aria-label="Information verified by Kondo"
                    className="h-4 w-4"
                  />
                ) : null}
              </p>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                {item.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">
                  {item.fundingType === "FULL"
                    ? "Full funding"
                    : "Partial funding"}
                </span>
                {item.fields.slice(0, 2).map((studyField) => (
                  <span
                    className="rounded-full bg-muted px-3 py-1 text-xs"
                    key={studyField}
                  >
                    {studyField}
                  </span>
                ))}
              </div>
              <div className="mt-4 text-xs leading-5 text-muted-foreground">
                <p>
                  {linkedUniversities.length
                    ? linkedUniversities.slice(0, 2).join(" · ")
                    : (item.country?.name ?? "Multiple destinations")}
                </p>
                <p className="mt-1 inline-flex items-center gap-1 font-bold">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {remainingLabel(item.closesAt)}
                </p>
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                <ScholarshipActions
                  id={item.id}
                  initialStatus={item.favorites[0]?.status ?? null}
                />
                <Link
                  className="inline-flex items-center gap-1 text-sm font-black text-kondo-green transition group-hover:gap-2"
                  href={`/student-hub/scholarships/${item.slug}`}
                >
                  View details <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Card>
          );
        })}
      </section>
      {!scholarships.length ? (
        <Card className="mt-6 py-16 text-center">
          <GraduationCap className="mx-auto h-9 w-9 text-kondo-green" />
          <h2 className="mt-4 text-xl font-black">
            No opportunity matches these filters.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Try a broader destination, level, or funding type.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
