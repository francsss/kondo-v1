"use client";

import {
  StudentRow,
  StudentRowSkeleton,
} from "@/components/features/community/StudentRow";
import type { MeetDiscoveryProfile } from "@/components/features/community/MeetDiscoveryMap";

/**
 * Looking For results, as a list.
 *
 * This used to be a map — the same map Nearby had, plotting the same
 * hash-derived points. Looking For never even asked a geographic question: it
 * asks who matches what you are here for, and a constellation of scattered
 * markers answered that worse than a list of names does.
 *
 * It shares `StudentRow` with Nearby so the two read as one product, and
 * differs only in the context line. Nearby says how far away someone is and
 * why they are relevant; here the distance comes first and then what actually
 * matched, which is the thing the reader chose.
 */

const INTENT_LABELS: Record<string, string> = {
  STUDY_PARTNER: "Study partner",
  LANGUAGE_EXCHANGE: "Language exchange",
  FRIENDSHIP: "Friendship",
  SPORTS: "Sports",
  CAMPUS_EVENTS: "Campus events",
  CAREER: "Career",
  MENTORSHIP: "Mentorship",
  ROOMMATE: "Roommate",
};

function intentLabel(value: string) {
  return INTENT_LABELS[value] ?? value.toLowerCase().replace(/_/g, " ");
}

/**
 * What matched, in the reader's own terms.
 *
 * One line, and only things they asked for: the intents they selected that
 * this person also listed, or an interest they share. Never a tally of five
 * attributes, and never age or gender — Looking For is a student network, not
 * a dating filter.
 */
function matchContext(
  profile: MeetDiscoveryProfile,
  selectedIntents: string[],
) {
  const sharedIntents = profile.lookingFor.filter((intent) =>
    selectedIntents.includes(intent),
  );
  const matched =
    sharedIntents.length === 1
      ? intentLabel(sharedIntents[0]!)
      : sharedIntents.length > 1
        ? `Matches ${sharedIntents.length} of your reasons`
        : profile.sharedInterests.length
          ? `${profile.sharedInterests[0]} in common`
          : null;

  return [profile.distanceLabel, matched].filter(Boolean).join(" · ") || null;
}

export function LookingForResults({
  profiles,
  selectedIntents,
  loading,
  onRetry,
  error,
}: {
  profiles: MeetDiscoveryProfile[];
  selectedIntents: string[];
  loading: boolean;
  onRetry: () => void;
  error?: string;
}) {
  if (loading) {
    return (
      <ul className="mt-2" aria-label="Loading matches">
        {Array.from({ length: 6 }).map((_, index) => (
          <StudentRowSkeleton key={index} />
        ))}
      </ul>
    );
  }

  if (error) {
    return (
      <div className="mt-8 text-center">
        <p className="text-sm font-bold text-foreground">
          Couldn&rsquo;t load matches.
        </p>
        <button
          className="mt-4 inline-flex min-h-11 items-center rounded-full border border-border bg-card px-5 text-sm font-black transition hover:border-kondo-green/40"
          onClick={onRetry}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!profiles.length) {
    return (
      <div className="mt-8 text-center">
        <p className="text-sm font-bold text-foreground">No matches found.</p>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
          Try adjusting your preferences.
        </p>
      </div>
    );
  }

  /*
   * Deduplicated by ID before rendering: the same person must never appear
   * twice, whatever the query returned.
   */
  const seen = new Set<string>();
  const unique = profiles.filter((profile) => {
    if (seen.has(profile.id)) return false;
    seen.add(profile.id);
    return true;
  });

  return (
    <ul aria-label="People matching what you are looking for" className="mt-2">
      {unique.map((profile) => (
        <StudentRow
          key={profile.id}
          student={{
            id: profile.id,
            username: profile.username,
            firstName: profile.firstName,
            lastName: profile.lastName,
            avatarMediaId: profile.avatarMediaId,
            headline:
              [profile.university, profile.location?.city]
                .filter(Boolean)
                .join(" · ") || null,
            context: matchContext(profile, selectedIntents),
          }}
        />
      ))}
    </ul>
  );
}
