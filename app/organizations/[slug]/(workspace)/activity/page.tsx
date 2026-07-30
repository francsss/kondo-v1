import { Card } from "@/components/ui/Card";
import { listOrganizationActivity } from "@/lib/organization-workspaces";
import { requireUser } from "@/lib/server-auth";

export default async function OrganizationActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const slug = (await params).slug;
  const page = Number((await searchParams).page ?? "1");
  const activity = await listOrganizationActivity(user.id, slug, page);
  return (
    <div>
      <h2 className="text-2xl font-black tracking-tight">Activity history</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A bounded operational history. Security metadata and private reviewer
        notes are never shown here.
      </p>
      <Card className="mt-6 p-5 sm:p-7">
        <div className="divide-y divide-border">
          {activity.events.map((event) => (
            <article className="flex gap-4 py-4" key={event.id}>
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-kondo-green" />
              <div>
                <h3 className="text-sm font-black capitalize">
                  {event.action.replaceAll("_", " ").toLowerCase()}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.actor
                    ? `${event.actor.firstName} ${event.actor.lastName}`
                    : "Kondo system"}{" "}
                  · {new Date(event.createdAt).toLocaleString()}
                </p>
              </div>
            </article>
          ))}
          {!activity.events.length ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No organization activity has been recorded yet.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
