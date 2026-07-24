import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Globe2,
  Languages,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import { AgentContactActions } from "@/components/features/student-hub/AgentContactActions";
import { ScholarshipNav } from "@/components/features/student-hub/ScholarshipNav";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Scholarship agents" };

export default async function ScholarshipAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    country?: string;
    language?: string;
    specialty?: string;
    availability?: string;
    verified?: string;
  }>;
}) {
  await requireUser();
  const {
    q = "",
    country,
    language,
    specialty,
    availability,
    verified,
  } = await searchParams;
  const where: Prisma.ScholarshipAgentWhereInput = {
    isActive: true,
    ...(country ? { countryId: country } : {}),
    ...(language ? { languages: { has: language } } : {}),
    ...(specialty ? { specialties: { has: specialty } } : {}),
    ...(availability === "AVAILABLE" ||
    availability === "LIMITED" ||
    availability === "UNAVAILABLE"
      ? { availability }
      : {}),
    ...(verified ? { verified: true } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
            { specialties: { has: q } },
            { services: { has: q } },
          ],
        }
      : {}),
  };
  const [agents, countries, facets] = await Promise.all([
    prisma.scholarshipAgent.findMany({
      where,
      include: { country: { select: { name: true } } },
      orderBy: [{ verified: "desc" }, { availability: "asc" }, { name: "asc" }],
    }),
    prisma.country.findMany({
      where: {
        isActive: true,
        scholarshipAgents: { some: { isActive: true } },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.scholarshipAgent.findMany({
      where: { isActive: true },
      select: { languages: true, specialties: true },
    }),
  ]);
  const languages = [
    ...new Set(facets.flatMap((item) => item.languages)),
  ].sort();
  const specialties = [
    ...new Set(facets.flatMap((item) => item.specialties)),
  ].sort();
  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-kondo-green">
          Scholarship agents
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
          Find the right support for your application.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Compare expertise, languages, services and availability before
          contacting an adviser directly.
        </p>
      </div>
      <ScholarshipNav active="agents" />
      <Card className="mt-6">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex h-11 items-center gap-3 rounded-2xl border border-border px-4 md:col-span-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              aria-label="Search scholarship agents"
              className="w-full bg-transparent text-sm outline-none"
              defaultValue={q}
              name="q"
              placeholder="Name, company, service or specialty"
            />
          </label>
          <AgentFilter
            defaultValue={country}
            label="Country"
            name="country"
            options={countries.map((item) => [item.id, item.name])}
          />
          <AgentFilter
            defaultValue={availability}
            label="Availability"
            name="availability"
            options={[
              ["AVAILABLE", "Available"],
              ["LIMITED", "Limited availability"],
              ["UNAVAILABLE", "Unavailable"],
            ]}
          />
          <AgentFilter
            defaultValue={language}
            label="Language"
            name="language"
            options={languages.map((item) => [item, item])}
          />
          <AgentFilter
            defaultValue={specialty}
            label="Specialty"
            name="specialty"
            options={specialties.map((item) => [item, item])}
          />
          <label className="flex h-11 items-center gap-2 rounded-2xl border border-border px-4 text-sm font-bold">
            <input
              defaultChecked={Boolean(verified)}
              name="verified"
              type="checkbox"
              value="1"
            />
            Verified only
          </label>
          <button className="h-11 rounded-full bg-kondo-ink px-6 text-sm font-black text-white dark:bg-emerald-400 dark:text-kondo-ink">
            Apply filters
          </button>
        </form>
      </Card>
      <div className="mt-6 flex items-start gap-3 rounded-3xl bg-emerald-50 p-4 text-sm text-emerald-950 dark:bg-emerald-400/10 dark:text-emerald-100">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          <strong>Kondo safety tip:</strong> verification confirms profile
          checks, not admission outcomes. Never pay for a guaranteed scholarship
          and always verify official university requirements.
        </p>
      </div>
      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        {agents.map((agent) => (
          <Card className="flex h-full flex-col" key={agent.id}>
            <div className="flex items-start gap-4">
              <div
                aria-label={agent.logoUrl ? `${agent.name} logo` : undefined}
                className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-kondo-mint bg-cover bg-center text-xl font-black text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
                role={agent.logoUrl ? "img" : undefined}
                style={
                  agent.logoUrl
                    ? { backgroundImage: `url("${agent.logoUrl}")` }
                    : undefined
                }
              >
                {agent.logoUrl
                  ? null
                  : agent.name
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-black">{agent.name}</h2>
                  {agent.verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Verified by Kondo
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-bold text-kondo-green">
                  {agent.company ?? "Independent adviser"}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {agent.country ? (
                    <span className="inline-flex items-center gap-1">
                      <Globe2 className="h-3.5 w-3.5" />
                      {agent.country.name}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1">
                    <BriefcaseBusiness className="h-3.5 w-3.5" />
                    {agent.availability.replaceAll("_", " ").toLowerCase()}
                  </span>
                  {agent.averageRating !== null ? (
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {agent.averageRating.toFixed(1)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            {agent.biography ? (
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {agent.biography}
              </p>
            ) : null}
            <div className="mt-4 space-y-3 text-sm">
              {agent.languages.length ? (
                <p className="flex items-start gap-2">
                  <Languages className="mt-0.5 h-4 w-4 shrink-0 text-kondo-green" />
                  <span>{agent.languages.join(", ")}</span>
                </p>
              ) : null}
              {agent.specialties.length ? (
                <div className="flex flex-wrap gap-2">
                  {agent.specialties.map((item) => (
                    <span
                      className="rounded-full bg-muted px-3 py-1 text-xs font-bold"
                      key={item}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
              {agent.services.length ? (
                <p>
                  <strong>Services:</strong> {agent.services.join(", ")}
                </p>
              ) : null}
              {agent.feeDetails ? (
                <p>
                  <strong>Fees:</strong> {agent.feeDetails}
                </p>
              ) : null}
            </div>
            <div className="mt-auto pt-5">
              <AgentContactActions
                agentId={agent.id}
                email={agent.email}
                name={agent.name}
                wechat={agent.wechat}
                whatsapp={agent.whatsapp}
              />
              {agent.website ? (
                <a
                  className="mt-3 inline-block text-xs font-black text-kondo-green"
                  href={agent.website}
                  rel="noreferrer"
                  target="_blank"
                >
                  Visit website ↗
                </a>
              ) : null}
            </div>
          </Card>
        ))}
      </section>
      {!agents.length ? (
        <Card className="mt-6 py-16 text-center">
          <BriefcaseBusiness className="mx-auto h-9 w-9 text-kondo-green" />
          <h2 className="mt-4 text-xl font-black">
            No agent matches these filters.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Try another language, specialty, or availability.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function AgentFilter({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: Array<readonly [string, string]>;
}) {
  return (
    <select
      aria-label={label}
      className="h-11 min-w-0 rounded-2xl border border-border bg-background px-3 text-sm"
      defaultValue={defaultValue ?? ""}
      name={name}
    >
      <option value="">All {label.toLowerCase()}</option>
      {options.map(([value, optionLabel]) => (
        <option key={value} value={value}>
          {optionLabel}
        </option>
      ))}
    </select>
  );
}
