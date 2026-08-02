import type { Metadata } from "next";
import {
  BookOpenText,
  GraduationCap,
  Languages,
  Microscope,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Resources",
  description: "Academic resources that help students succeed in China.",
};

/**
 * Resources module.
 *
 * Structure and navigation only for now: the categories below describe what
 * this space will hold, without pretending anything is published yet. Nothing
 * here reads or writes data, so no model, API or permission is involved.
 */
const PLANNED_CATEGORIES = [
  {
    key: "study-materials",
    label: "Study materials",
    description:
      "Course notes, past papers and revision packs shared on Kondo.",
    icon: BookOpenText,
  },
  {
    key: "academic-guides",
    label: "Academic guides",
    description:
      "How registration, credits, exams and graduation actually work here.",
    icon: GraduationCap,
  },
  {
    key: "research",
    label: "Research resources",
    description: "Finding a supervisor, reading papers and writing a thesis.",
    icon: Microscope,
  },
  {
    key: "languages",
    label: "Language learning",
    description: "Mandarin practice and academic language support.",
    icon: Languages,
  },
  {
    key: "ai-tools",
    label: "AI study tools",
    description:
      "Reviewed tools for studying, with guidance on using them well.",
    icon: Sparkles,
  },
] as const;

export default function StudentHubResourcesPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-kondo-green">
          Student Hub
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
          Resources
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Everything that helps you actually get through your studies, in one
          place.
        </p>
      </header>

      {/* An honest empty state: the space exists, the content does not yet. */}
      <div className="mt-8 rounded-3xl border border-dashed border-border p-8 text-center">
        <h2 className="text-lg font-black">Nothing published yet</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Resources are being prepared. The categories below are what this space
          will hold — nothing is hidden from you today.
        </p>
      </div>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PLANNED_CATEGORIES.map((category) => {
          const Icon = category.icon;
          return (
            <li key={category.key}>
              <article className="flex h-full flex-col rounded-3xl border border-border bg-card p-5">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-black">{category.label}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {category.description}
                </p>
                <p className="mt-auto pt-4 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                  Coming soon
                </p>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
