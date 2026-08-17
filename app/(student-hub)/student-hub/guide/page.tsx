import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Guide — Student Hub" };

/**
 * The parent of every guide the hub links to.
 *
 * Guide steps open at `/student-hub/guide/<slug>`, so members reach for the
 * path above it — from a truncated link, from browser autocomplete, or by
 * editing the URL. Until now nothing answered there: the segment had only a
 * `[slug]` route, so the URL fell through to the root not-found, which renders
 * outside the hub shell. That page has neither the hub's own navigation nor
 * the back button that leaves the space, which is how a member ended up on a
 * screen with no way out of the Student Hub at all.
 *
 * A redirect rather than a second library: `/guides` already is the library,
 * and maintaining two of them would guarantee they drift.
 */
export default function StudentHubGuideIndex() {
  redirect("/guides");
}
