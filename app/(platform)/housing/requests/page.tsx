import type { Metadata } from "next";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { HousingNav } from "@/components/features/housing/HousingNav";
import { HousingRequestActions } from "@/components/features/housing/HousingRequestActions";
import { HousingRequestComposer } from "@/components/features/housing/HousingRequestComposer";
import { Card } from "@/components/ui/Card";
import { listHousingRequests } from "@/lib/housing-requests";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Housing Requests",
  robots: "noindex",
};

function RequestCard({
  request,
}: {
  request: Awaited<ReturnType<typeof listHousingRequests>>[number];
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-black">
            Looking in {request.city.name}
          </p>
          <p className="mt-1 text-xs font-bold text-muted-foreground">
            {request.requester.name}
          </p>
        </div>
        <span className="rounded-full bg-kondo-green/10 px-3 py-1 text-xs font-black text-kondo-green">
          Up to {request.currency}{" "}
          {Math.round(request.maximumBudgetMinor / 100)}/month
        </span>
      </div>
      <p className="mt-4 line-clamp-4 text-sm leading-6 text-muted-foreground">
        {request.description}
      </p>
      <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {request.preferredDistrict ?? request.city.name}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          {request.moveInDate
            ? new Date(request.moveInDate).toLocaleDateString("en")
            : "Flexible"}
        </span>
        {request.roommateOpen ? (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> Roommate open
          </span>
        ) : null}
      </div>
      {request.owner ? (
        <div className="mt-5 border-t border-border pt-4">
          <HousingRequestActions
            requestId={request.id}
            status={request.status}
          />
        </div>
      ) : null}
    </Card>
  );
}

export default async function HousingRequestsPage() {
  const user = await requireUser();
  const [cities, community, mine] = await Promise.all([
    prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    listHousingRequests({ viewerId: user.id, limit: 30 }),
    listHousingRequests({ viewerId: user.id, mine: true, limit: 20 }),
  ]);
  return (
    <main className="mx-auto max-w-[1200px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <HousingNav active="/housing/requests" />
      <div className="mt-7">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
          Community needs
        </p>
        <h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">
          Housing requests
        </h1>
        <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
          Tell the community what you need without publishing private contact
          details. Responses stay inside Kondo.
        </p>
        <div className="mt-5">
          <HousingRequestComposer cities={cities} />
        </div>
      </div>
      {mine.length ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-black">My requests</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {mine.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>
        </section>
      ) : null}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-black">Community requests</h2>
        {community.length ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {community.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>
        ) : (
          <Card className="mt-4 text-center text-sm text-muted-foreground">
            No active Housing requests yet.
          </Card>
        )}
      </section>
    </main>
  );
}
