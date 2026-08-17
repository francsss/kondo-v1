"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The three stages of studying abroad, and what Kondo does in each.
 *
 * This is the page's argument, so it is the page's centrepiece. A visitor
 * arrives asking "what is this for?", and a grid of feature cards answers that
 * badly — it lists parts. Kondo is not a set of parts; it is the thing that
 * carries someone from an application in one country to a career in another.
 * So the section is built around that arc, and each stage shows the actual
 * interface rather than an icon standing in for it.
 *
 * Desktop gets a tablist. Mobile gets the same panels as a scroll-snap rail,
 * because a row of tabs above a panel wastes the only screen dimension a phone
 * has. Both are the same markup and the same data; neither needs the other.
 *
 * No animation library, no images, no canvas — the previews are ordinary
 * elements, which keeps them sharp at any size, legible in both themes and
 * free of layout shift.
 */

type Stage = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  surfaces: string[];
  preview: React.ReactNode;
};

/** A small, honest facsimile of a Kondo surface. */
function PreviewFrame({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_60px_-30px_rgba(20,71,58,0.45)]">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-kondo-green" />
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function ChecklistPreview() {
  return (
    <PreviewFrame label="Guide">
      <p className="text-sm font-black tracking-[-0.02em]">
        Your first 72 hours in China
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-[62%] rounded-full bg-kondo-green" />
      </div>
      <ul className="mt-4 space-y-2.5">
        {[
          ["Residence permit appointment", true],
          ["Open a local bank account", true],
          ["Register at the police station", false],
          ["Set up campus health cover", false],
        ].map(([label, done]) => (
          <li className="flex items-center gap-2.5" key={label as string}>
            <span
              className={cn(
                "grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-black",
                done
                  ? "bg-kondo-green text-white"
                  : "border border-border text-transparent",
              )}
            >
              ✓
            </span>
            <span
              className={cn(
                "text-xs font-bold",
                done ? "text-muted-foreground line-through" : "text-foreground",
              )}
            >
              {label as string}
            </span>
          </li>
        ))}
      </ul>
    </PreviewFrame>
  );
}

function CommunityPreview() {
  return (
    <PreviewFrame label="Communities">
      <div className="space-y-3">
        {[
          ["Nana O.", "Platform Operations · THU", "< 1 km away"],
          ["Chidi O.", "Finance · PKU", "2 km away"],
          ["Kwame N.", "Computer Science · PKU", "2 km away"],
        ].map(([name, detail, distance]) => (
          <div className="flex items-center gap-3" key={name}>
            <span className="h-9 w-9 shrink-0 rounded-full bg-muted" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-black">{name}</span>
              <span className="block truncate text-[11px] font-bold text-muted-foreground">
                {detail}
              </span>
            </span>
            <span className="shrink-0 text-[11px] font-black text-kondo-green">
              {distance}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-border pt-3 text-[11px] font-bold text-muted-foreground">
        Students near you, and the ones who share your campus.
      </p>
    </PreviewFrame>
  );
}

function FuturePreview() {
  return (
    <PreviewFrame label="Opportunities">
      <div className="space-y-2.5">
        {[
          ["Graduate scholarship", "Applications open"],
          ["Internship · Shanghai", "6 months"],
          ["Alumni mentoring", "Open to final year"],
        ].map(([title, meta]) => (
          <div
            className="rounded-2xl border border-border px-3.5 py-3"
            key={title}
          >
            <p className="text-xs font-black">{title}</p>
            <p className="mt-0.5 text-[11px] font-bold text-kondo-green">
              {meta}
            </p>
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

const STAGES: Stage[] = [
  {
    id: "before",
    eyebrow: "Before China",
    title: "Arrive knowing what happens next",
    description:
      "The paperwork, the packing, the first week — written down in order by students who have already done it.",
    surfaces: ["Guide", "Student Hub"],
    preview: <ChecklistPreview />,
  },
  {
    id: "during",
    eyebrow: "In China",
    title: "Study, live, and find your people",
    description:
      "Your campus, your city, your communities — and the students nearby who are worth knowing.",
    surfaces: ["Communities", "Marketplace", "Study"],
    preview: <CommunityPreview />,
  },
  {
    id: "after",
    eyebrow: "After graduation",
    title: "Turn the years into a career",
    description:
      "Scholarships, internships and alumni who have taken the step you are about to take.",
    surfaces: ["Opportunities", "Future"],
    preview: <FuturePreview />,
  },
];

function StageCopy({ stage }: { stage: Stage }) {
  return (
    <>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
        {stage.eyebrow}
      </p>
      <h3 className="mt-3 text-balance text-2xl font-black tracking-[-0.04em] sm:text-3xl">
        {stage.title}
      </h3>
      <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
        {stage.description}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {stage.surfaces.map((surface) => (
          <span
            className="rounded-full border border-border px-3 py-1 text-[11px] font-black text-muted-foreground"
            key={surface}
          >
            {surface}
          </span>
        ))}
      </div>
    </>
  );
}

export function JourneyShowcase() {
  const [active, setActive] = useState(0);
  const baseId = useId();

  return (
    <div>
      {/*
       * Mobile: one panel per card on a scroll-snap rail. It needs no
       * JavaScript at all — swiping is the interaction, and every stage is
       * reachable even if this component never hydrates.
       */}
      <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
        {STAGES.map((stage) => (
          <section
            className="w-[85vw] max-w-sm shrink-0 snap-center"
            key={stage.id}
          >
            <StageCopy stage={stage} />
            <div className="mt-6">{stage.preview}</div>
          </section>
        ))}
      </div>

      {/* Desktop: a proper tablist, with the preview beside the copy. */}
      <div className="hidden lg:block">
        <div
          aria-label="The student journey"
          className="flex gap-2 border-b border-border"
          role="tablist"
        >
          {STAGES.map((stage, index) => (
            <button
              aria-controls={`${baseId}-panel-${stage.id}`}
              aria-selected={active === index}
              className={cn(
                "relative min-h-12 px-5 text-sm transition",
                active === index
                  ? "font-black text-kondo-green after:absolute after:inset-x-4 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-kondo-green"
                  : "font-bold text-muted-foreground hover:text-foreground",
              )}
              id={`${baseId}-tab-${stage.id}`}
              key={stage.id}
              onClick={() => setActive(index)}
              role="tab"
              type="button"
            >
              {stage.eyebrow}
            </button>
          ))}
        </div>

        {STAGES.map((stage, index) => (
          <div
            aria-labelledby={`${baseId}-tab-${stage.id}`}
            /*
             * `grid`, not `block`, for the visible state: `block` would win on
             * `display` and collapse the two columns into a stack with an
             * empty half beside it.
             */
            className={cn(
              "gap-12 pt-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center",
              active === index ? "grid" : "hidden",
            )}
            id={`${baseId}-panel-${stage.id}`}
            key={stage.id}
            role="tabpanel"
          >
            <div>
              <StageCopy stage={stage} />
            </div>
            {/*
             * Keyed on the stage so switching tabs replays the entrance. The
             * transition is `motion-safe` only, so a reader who asked for less
             * motion simply gets an instant swap.
             */}
            <div
              className="motion-safe:animate-[fade-up_0.5s_ease-out]"
              key={stage.id}
            >
              {stage.preview}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
