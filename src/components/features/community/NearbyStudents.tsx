"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import {
  StudentRow,
  StudentRowSkeleton,
} from "@/components/features/community/StudentRow";
import { Button } from "@/components/ui/Button";
import type { NearbyFilter, NearbyStudent } from "@/lib/nearby-students";

/**
 * A list of students near you, and nothing else.
 *
 * The surface this replaces was a map: a provider SDK, markers, zoom state and
 * a bottom sheet, in front of data that was never geographic to begin with.
 * What people actually wanted from it — who is around, and why they are worth
 * a message — is a list, so this is a list. Rows are deliberately plain: an
 * avatar, a name, one line of academic identity, one line of context. No card
 * borders, no shadows, no nesting.
 */

const FILTERS: Array<{ value: NearbyFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "UNIVERSITY", label: "Same university" },
  { value: "CITY", label: "Same city" },
];

type Status = "loading" | "ready" | "error";

/**
 * Nearby's context line: how far away, then one reason they are relevant.
 *
 * The distance leads because it is the question the page answers. The
 * proximity label only stands in when no distance could be computed — an
 * unmapped place, or a student who keeps their location private — so the line
 * never says "3 km away · Same city" and never repeats itself.
 */
function nearbyContext(student: NearbyStudent) {
  return (
    [student.distance ?? student.proximity, student.reason]
      .filter(Boolean)
      .join(" · ") || null
  );
}

export function NearbyStudents({
  hasStudyLocation,
  initialStudents,
  initialCursor,
  initialDiscoverable,
}: {
  hasStudyLocation: boolean;
  /** Whether the viewer themselves appears in other people's Nearby. */
  initialDiscoverable: boolean;
  /*
   * The first page is rendered on the server, so the list is on screen in the
   * first paint with no request from the browser at all. The client only
   * fetches when the reader asks it to — a different filter, or more rows.
   */
  initialStudents: NearbyStudent[];
  initialCursor: string | null;
}) {
  const [filter, setFilter] = useState<NearbyFilter>("ALL");
  const [students, setStudents] = useState<NearbyStudent[]>(initialStudents);
  const [status, setStatus] = useState<Status>("ready");
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [discoverable, setDiscoverable] = useState(initialDiscoverable);
  // Guards against a slow first request overwriting a newer filter's results.
  const requestRef = useRef(0);

  /*
   * Only ever writes state after the request settles. The "loading" and
   * "loading more" transitions belong to the interactions that cause them —
   * choosing a filter, retrying, asking for more — so the effect below stays a
   * plain fetch and never sets state on its way in.
   */
  const load = useCallback(
    async (nextFilter: NearbyFilter, cursor?: string) => {
      if (!hasStudyLocation) return;
      const request = (requestRef.current += 1);
      try {
        const params = new URLSearchParams({ filter: nextFilter });
        if (cursor) params.set("cursor", cursor);
        const response = await fetch(`/api/community/nearby?${params}`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Nearby request failed.");
        const body = (await response.json()) as {
          students: NearbyStudent[];
          nextCursor: string | null;
        };
        if (request !== requestRef.current) return;
        setStudents((current) =>
          cursor ? [...current, ...body.students] : body.students,
        );
        setNextCursor(body.nextCursor);
        setStatus("ready");
      } catch {
        if (request !== requestRef.current) return;
        setStatus("error");
      } finally {
        if (request === requestRef.current) setLoadingMore(false);
      }
    },
    [hasStudyLocation],
  );

  if (!hasStudyLocation) {
    /*
     * Kondo derives "near" from the study city on a profile, not from a device
     * GPS reading — so the thing to ask for is the missing profile field, not a
     * browser permission. Asking for a location Kondo cannot store would be
     * theatre, and inventing a distance from it would be a lie.
     */
    return (
      <section className="mt-6 rounded-3xl border border-border bg-card p-6 text-center">
        <h2 className="text-base font-black tracking-[-0.02em]">
          Find students near you
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          Add your study city to your profile and Kondo will show the students
          around you.
        </p>
        <Button asChild className="mt-5" size="sm">
          <Link href="/profile/edit">Add your study city</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black tracking-[-0.03em]">Nearby</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            People around you
          </p>
        </div>
        {/*
         * One switch, not a privacy dashboard. It controls whether the viewer
         * is listed for other people; it does not change what they can see.
         */}
        <button
          aria-checked={discoverable}
          className={`mt-0.5 inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-black transition active:scale-[0.98] motion-reduce:transform-none ${
            discoverable
              ? "border-kondo-green/30 bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
              : "border-border bg-muted text-muted-foreground"
          }`}
          onClick={() => {
            const next = !discoverable;
            setDiscoverable(next);
            void fetch("/api/community/nearby/visibility", {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ discoverable: next }),
              // A failed write must not leave the switch lying about the
              // stored value, so it goes back on error.
            }).then(
              (response) => {
                if (!response.ok) setDiscoverable(!next);
              },
              () => setDiscoverable(!next),
            );
          }}
          role="switch"
          type="button"
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${
              discoverable ? "bg-kondo-green" : "bg-muted-foreground/50"
            }`}
          />
          {discoverable ? "Visible to others" : "Hidden from others"}
        </button>
      </div>

      <div
        aria-label="Filter nearby students"
        className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        {FILTERS.map((option) => (
          <button
            aria-selected={filter === option.value}
            className={`min-h-9 shrink-0 rounded-full px-3.5 text-xs font-black transition active:scale-[0.98] motion-reduce:transform-none ${
              filter === option.value
                ? "bg-kondo-green text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
            key={option.value}
            onClick={() => {
              if (option.value === filter) return;
              setStatus("loading");
              setStudents([]);
              setNextCursor(null);
              setFilter(option.value);
              void load(option.value);
            }}
            role="tab"
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      {status === "error" ? (
        <div className="mt-8 text-center">
          <p className="text-sm font-bold text-foreground">
            Couldn&rsquo;t load nearby students.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setStatus("loading");
              void load(filter);
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            Try again
          </Button>
        </div>
      ) : null}

      {status === "loading" ? (
        <ul className="mt-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <StudentRowSkeleton key={index} />
          ))}
        </ul>
      ) : null}

      {status === "ready" && students.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-sm font-bold text-foreground">
            No students nearby yet.
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            Try again later or explore your university community.
          </p>
          <Button asChild className="mt-4" size="sm" variant="secondary">
            <Link href="/communities?tab=discover">Explore communities</Link>
          </Button>
        </div>
      ) : null}

      {status === "ready" && students.length ? (
        <>
          <ul aria-label="Students near you" className="mt-2">
            {students.map((student) => (
              <StudentRow
                key={student.id}
                student={{ ...student, context: nearbyContext(student) }}
              />
            ))}
          </ul>
          {nextCursor ? (
            <div className="mt-5 flex justify-center">
              <Button
                disabled={loadingMore}
                onClick={() => {
                  setLoadingMore(true);
                  void load(filter, nextCursor);
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                {loadingMore ? "Loading…" : "Show more"}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
