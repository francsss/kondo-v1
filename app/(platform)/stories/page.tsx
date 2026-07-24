import type { Metadata } from "next";
import { StoryReader } from "@/components/features/stories/StoryReader";
import { getStoryFeed } from "@/lib/stories";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Student Stories",
  description:
    "Useful short videos that connect student life in China to the rest of Kondo.",
};

function safeReturnTo(value?: string) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return undefined;
  }
  return value.slice(0, 500);
}

function safeEntryPoint(value?: string) {
  return value && /^[a-z][a-z0-9_-]{0,39}$/i.test(value) ? value : undefined;
}

export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const selected = Array.isArray(params.story) ? params.story[0] : params.story;
  const rawFrom = Array.isArray(params.from) ? params.from[0] : params.from;
  const rawEntry = Array.isArray(params.entry) ? params.entry[0] : params.entry;
  const stories = await getStoryFeed(user, { storySlug: selected, limit: 20 });
  return (
    <StoryReader
      entryPoint={safeEntryPoint(rawEntry)}
      initialStories={stories}
      returnTo={safeReturnTo(rawFrom)}
    />
  );
}
