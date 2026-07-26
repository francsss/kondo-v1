import type { Metadata } from "next";
import { OpportunityDirectory } from "@/components/features/student-hub/OpportunityDirectory";
import { getStudentOpportunities } from "@/lib/student-opportunities";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Internships" };

export default async function InternshipsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const [{ q = "" }, opportunities] = await Promise.all([
    searchParams,
    getStudentOpportunities(),
  ]);
  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-kondo-green">
        Internships
      </p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
        Verified pathways into practical experience.
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Search internship entries published by Kondo’s official City Hubs and
        continue through the original application source.
      </p>
      <OpportunityDirectory internshipsOnly items={opportunities} query={q} />
    </div>
  );
}
