import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Library, Package } from "lucide-react";
import { StudyEssentialCover } from "@/components/features/student-hub/StudyEssentialCover";
import { StudyEssentialsNav } from "@/components/features/student-hub/StudyEssentialsNav";
import { requireUser } from "@/lib/server-auth";
import { listLibrary } from "@/lib/study-workspace";

export const metadata: Metadata = {
  title: "My Library — Study Essentials",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudyLibraryPage() {
  const user = await requireUser();
  const library = await listLibrary(user.id);
  const readable = library.filter(
    (entry) =>
      entry.essential.format === "DIGITAL" &&
      entry.essential._count.chapters > 0,
  );
  const materials = library.filter(
    (entry) =>
      entry.essential.format === "PHYSICAL" ||
      entry.essential._count.chapters === 0,
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="max-w-3xl">
        <h1 className="text-balance font-display text-3xl font-black leading-[1.1] tracking-[-0.04em] sm:text-4xl">
          My Library
        </h1>
        <p className="mt-3 text-pretty text-sm leading-7 text-muted-foreground sm:text-base">
          Everything you have acquired, in one place. Digital titles open in
          the reader, where you can highlight passages, keep notes and raise
          tasks straight into your planner.
        </p>
      </header>

      <div className="mt-6">
        <StudyEssentialsNav active="library" />
      </div>

      {library.length ? (
        <div className="mt-8 grid gap-10">
          <LibrarySection
            description="Open to read, highlight and take notes."
            empty="Digital titles you acquire will open here."
            icon={BookOpen}
            items={readable}
            readable
            title="Digital Books"
          />
          <LibrarySection
            description="Planners, notebooks and kits you have ordered."
            empty="Physical materials you order will be listed here."
            icon={Package}
            items={materials}
            title="Study Materials"
          />
        </div>
      ) : (
        <div className="mt-8 rounded-[2rem] border border-dashed border-border p-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Library aria-hidden="true" className="h-6 w-6" />
          </span>
          <p className="mt-4 font-black">Your library is empty</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Anything you acquire from Study Essentials arrives here
            automatically, ready to open.
          </p>
          <Link
            className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-black text-primary-foreground transition hover:bg-primary/90"
            href="/student-hub/essentials"
          >
            Browse Study Essentials
          </Link>
        </div>
      )}
    </div>
  );
}

function LibrarySection({
  title,
  description,
  icon: Icon,
  items,
  empty,
  readable = false,
}: {
  title: string;
  description: string;
  icon: typeof BookOpen;
  items: Awaited<ReturnType<typeof listLibrary>>;
  empty: string;
  readable?: boolean;
}) {
  return (
    <section>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-black tracking-tight">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {items.length ? (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map(({ essential, placedAt }) => (
            <li className="min-w-0" key={essential.id}>
              <Link
                className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-border bg-card transition hover:-translate-y-0.5 hover:border-kondo-green/50 hover:shadow-lift motion-reduce:transform-none"
                href={
                  readable
                    ? `/student-hub/essentials/read/${essential.slug}`
                    : `/student-hub/essentials/${essential.slug}`
                }
              >
                <StudyEssentialCover
                  className="aspect-[4/3] w-full"
                  coverEmoji={essential.coverEmoji}
                  emojiClassName="text-6xl transition duration-500 group-hover:scale-110 motion-reduce:transform-none"
                  imageUrl={essential.imageUrl}
                  slug={essential.slug}
                  title={essential.title}
                />
                <span className="flex flex-1 flex-col p-4">
                  <span className="line-clamp-2 font-black leading-snug group-hover:text-kondo-green">
                    {essential.title}
                  </span>
                  <span className="mt-1.5 text-xs text-muted-foreground">
                    Added{" "}
                    {new Intl.DateTimeFormat("en", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(placedAt)}
                  </span>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-kondo-green">
                    {readable ? (
                      <>
                        Open <ArrowUpRight className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      "View details"
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-border px-5 py-6 text-sm text-muted-foreground">
          {empty}
        </p>
      )}
    </section>
  );
}
