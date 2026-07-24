import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  FileText,
  Gift,
  GraduationCap,
  ListChecks,
  MapPin,
} from "lucide-react";
import { ScholarshipActions } from "@/components/features/student-hub/ScholarshipActions";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { effectiveScholarshipStatus } from "@/lib/scholarships";
import { requireUser } from "@/lib/server-auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const scholarship = await prisma.scholarship.findUnique({
    where: { slug: (await params).slug },
    select: { title: true },
  });
  return { title: scholarship?.title ?? "Scholarship" };
}

export default async function ScholarshipDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const scholarship = await prisma.scholarship.findFirst({
    where: { slug: (await params).slug, isActive: true },
    include: {
      country: { select: { name: true } },
      universities: {
        include: {
          university: {
            select: { name: true, city: { select: { name: true } } },
          },
        },
      },
      favorites: { where: { userId: user.id }, select: { status: true } },
    },
  });
  if (!scholarship) notFound();
  const status = effectiveScholarshipStatus(scholarship);
  return (
    <div className="mx-auto max-w-[1080px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <Link
        className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground transition hover:text-kondo-green"
        href="/student-hub/scholarships"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to scholarships
      </Link>
      <Card className="mt-6 overflow-hidden p-0">
        <div className="bg-[linear-gradient(135deg,#092b2b,#136f53)] px-5 py-10 text-white sm:px-9 sm:py-14">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-black uppercase backdrop-blur">
              {status.replaceAll("_", " ")}
            </span>
            <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-black uppercase backdrop-blur">
              {scholarship.fundingType === "FULL"
                ? "Full funding"
                : "Partial funding"}
            </span>
          </div>
          <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-[-0.04em] sm:text-5xl">
            {scholarship.title}
          </h1>
          <p className="mt-3 flex items-center gap-1 text-sm font-bold text-emerald-100 sm:text-base">
            {scholarship.provider}
            {scholarship.lastVerifiedAt ? (
              <BadgeCheck
                aria-label="Information verified by Kondo"
                className="h-5 w-5"
              />
            ) : null}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-kondo-ink transition hover:-translate-y-0.5"
              href={scholarship.applicationUrl}
              rel="noreferrer"
              target="_blank"
            >
              Apply on official site <ArrowUpRight className="h-4 w-4" />
            </a>
            <ScholarshipActions
              id={scholarship.id}
              initialStatus={scholarship.favorites[0]?.status ?? null}
            />
          </div>
        </div>
        <div className="grid gap-5 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <h2 className="text-xl font-black">About this opportunity</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
              {scholarship.description}
            </p>
          </div>
          <aside className="space-y-3 rounded-3xl bg-muted/60 p-5 text-sm">
            <p className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 text-kondo-green" />
              <span>
                <strong className="block">Application window</strong>
                {scholarship.opensAt?.toLocaleDateString() ?? "Open now"} –{" "}
                {scholarship.closesAt?.toLocaleDateString() ??
                  "No fixed deadline"}
              </span>
            </p>
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-kondo-green" />
              <span>
                <strong className="block">Destination</strong>
                {scholarship.city ??
                  scholarship.country?.name ??
                  "Multiple locations"}
              </span>
            </p>
            <p className="flex items-start gap-2">
              <GraduationCap className="mt-0.5 h-4 w-4 text-kondo-green" />
              <span>
                <strong className="block">Study levels</strong>
                {scholarship.studyLevels
                  .map((level) => `${level[0]}${level.slice(1).toLowerCase()}`)
                  .join(", ")}
              </span>
            </p>
          </aside>
        </div>
      </Card>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <InfoCard
          icon={CheckCircle2}
          items={scholarship.eligibilityCriteria}
          title="Eligibility"
        />
        <InfoCard
          icon={FileText}
          items={scholarship.requiredDocuments}
          title="Required documents"
        />
        <InfoCard
          icon={Gift}
          items={scholarship.coverage}
          title="What is covered"
        />
        <InfoCard
          icon={ListChecks}
          items={scholarship.applicationSteps}
          ordered
          title="Application steps"
        />
      </div>
      <Card className="mt-6">
        <h2 className="text-lg font-black">Participating universities</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {scholarship.universities.length ? (
            scholarship.universities.map(({ university }) => (
              <span
                className="rounded-full bg-muted px-4 py-2 text-sm font-bold"
                key={university.name}
              >
                {university.name} · {university.city.name}
              </span>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              This scholarship is not limited to a single university.
            </p>
          )}
        </div>
      </Card>
      {scholarship.lastVerifiedAt ? (
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Information last verified by Kondo on{" "}
          {scholarship.lastVerifiedAt.toLocaleDateString()}. Always confirm
          final requirements on the official website.
        </p>
      ) : null}
    </div>
  );
}

function InfoCard({
  title,
  items,
  icon: Icon,
  ordered = false,
}: {
  title: string;
  items: string[];
  icon: typeof CheckCircle2;
  ordered?: boolean;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-lg font-black">{title}</h2>
      </div>
      {items.length ? (
        <ol className="mt-4 space-y-3">
          {items.map((item, index) => (
            <li className="flex gap-3 text-sm leading-6" key={item}>
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-black">
                {ordered ? index + 1 : "✓"}
              </span>
              {item}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Confirm this section on the official scholarship website.
        </p>
      )}
    </Card>
  );
}
