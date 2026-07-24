"use client";

import {
  CalendarClock,
  CheckCircle2,
  Eye,
  LoaderCircle,
  Plus,
  Send,
  ShieldAlert,
  Star,
  UserRoundCog,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

type StoryRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  durationSeconds: number;
  videoMediaId: string;
  posterMediaId: string | null;
  isFeatured: boolean;
  isInstitutional: boolean;
  qualityScore: number;
  moderationReason: string | null;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string; icon: string | null };
  creator: {
    id: string;
    firstName: string;
    lastName: string;
    username: string | null;
    storyCreatorStatus: string;
    officialProfileStatus: string;
  };
  entityLinks: Array<{
    id: string;
    type: string;
    city: { name: string } | null;
    university: { name: string } | null;
    community: { name: string } | null;
    externalLabel: string | null;
  }>;
  _count: {
    likes: number;
    saves: number;
    comments: number;
    moderationEvents: number;
  };
};

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order: number;
  isActive: boolean;
  _count: { stories: number };
};

type Creator = {
  id: string;
  firstName: string;
  lastName: string;
  username: string | null;
  storyCreatorStatus: string;
  officialProfileStatus: string;
  _count: { stories: number };
};

export function StoryAdminManager({
  stories,
  categories,
  creators,
}: {
  stories: StoryRecord[];
  categories: Category[];
  creators: Creator[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"queue" | "categories" | "creators">("queue");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [scheduledAt, setScheduledAt] = useState<Record<string, string>>({});
  const [category, setCategory] = useState({
    name: "",
    slug: "",
    icon: "",
    description: "",
  });

  async function request(url: string, method: string, body: unknown) {
    setPending(url);
    setError("");
    const response = await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setPending("");
    if (!response?.ok) {
      setError(payload?.error ?? "The administrative action failed.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function transition(
    story: StoryRecord,
    status: string,
    needsReason = false,
    schedule?: string,
  ) {
    const reason = needsReason
      ? window.prompt("Give the creator a clear reason:")
      : `Reviewed by Kondo and moved to ${status.toLowerCase()}.`;
    if (needsReason && !reason) return;
    const updated = await request(`/api/admin/stories/${story.id}`, "PATCH", {
      status,
      reason,
      isFeatured: story.isFeatured,
      isInstitutional: story.isInstitutional,
      qualityScore: story.qualityScore,
      scheduledAt: schedule ? new Date(schedule).toISOString() : undefined,
    });
    if (!updated) return;
    if (status === "APPROVED") {
      captureProductEvent(PRODUCT_EVENTS.PUBLISH_REQUEST_APPROVED, {
        story_id: story.id,
      });
    } else if (status === "CHANGES_REQUESTED") {
      captureProductEvent(PRODUCT_EVENTS.PUBLISH_REQUEST_REVISION_REQUESTED, {
        story_id: story.id,
      });
    } else if (status === "REJECTED") {
      captureProductEvent(PRODUCT_EVENTS.PUBLISH_REQUEST_REJECTED, {
        story_id: story.id,
      });
    }
  }

  return (
    <div className="mt-7">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => setTab("queue")}
          type="button"
          variant={tab === "queue" ? "primary" : "secondary"}
        >
          <ShieldAlert className="h-4 w-4" /> Videos & moderation
        </Button>
        <Button
          onClick={() => setTab("categories")}
          type="button"
          variant={tab === "categories" ? "primary" : "secondary"}
        >
          <Plus className="h-4 w-4" /> Categories
        </Button>
        <Button
          onClick={() => setTab("creators")}
          type="button"
          variant={tab === "creators" ? "primary" : "secondary"}
        >
          <UserRoundCog className="h-4 w-4" /> Creators
        </Button>
      </div>
      {error ? (
        <p className="mt-4 rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {tab === "queue" ? (
        <div className="mt-5 space-y-4">
          {stories.map((story) => (
            <Card
              className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[220px_minmax(0,1fr)_240px]"
              key={story.id}
            >
              <div className="overflow-hidden rounded-2xl bg-black">
                <video
                  className="aspect-[9/14] max-h-72 w-full object-contain"
                  controls
                  poster={
                    story.posterMediaId
                      ? `/api/media/${story.posterMediaId}`
                      : undefined
                  }
                  preload="metadata"
                  src={`/api/media/${story.videoMediaId}`}
                />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-1 text-[9px] font-black uppercase tracking-wider">
                    {story.status.replaceAll("_", " ")}
                  </span>
                  <span className="text-[10px] font-black text-kondo-green">
                    {story.category.icon} {story.category.name}
                  </span>
                  {story.isFeatured ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-600">
                      <Star className="h-3 w-3" fill="currentColor" /> Featured
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-3 text-xl font-black text-kondo-ink dark:text-white">
                  {story.title}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                  {story.description}
                </p>
                <p className="mt-3 text-xs font-semibold text-muted-foreground">
                  {story.creator.firstName} {story.creator.lastName} ·{" "}
                  {story.creator.storyCreatorStatus.replaceAll("_", " ")} ·{" "}
                  {story.durationSeconds}s
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold text-muted-foreground">
                  {story.entityLinks.map((link) => (
                    <span
                      className="rounded-full border border-border px-2 py-1"
                      key={link.id}
                    >
                      {link.type}:{" "}
                      {link.city?.name ??
                        link.university?.name ??
                        link.community?.name ??
                        link.externalLabel}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-[10px] text-muted-foreground">
                  {story._count.likes} likes · {story._count.saves} saves ·{" "}
                  {story._count.comments} comments ·{" "}
                  {story._count.moderationEvents} moderation records
                </p>
              </div>
              <div className="space-y-2">
                {["PENDING_REVIEW", "RESUBMITTED"].includes(story.status) ? (
                  <>
                    <ActionButton
                      icon={CheckCircle2}
                      label="Approve"
                      onClick={() => transition(story, "APPROVED")}
                      pending={pending}
                      storyId={story.id}
                    />
                    <ActionButton
                      icon={Send}
                      label="Request changes"
                      onClick={() =>
                        transition(story, "CHANGES_REQUESTED", true)
                      }
                      pending={pending}
                      storyId={story.id}
                    />
                    <ActionButton
                      danger
                      icon={XCircle}
                      label="Reject"
                      onClick={() => transition(story, "REJECTED", true)}
                      pending={pending}
                      storyId={story.id}
                    />
                  </>
                ) : null}
                {story.status === "APPROVED" ? (
                  <>
                    <ActionButton
                      icon={Eye}
                      label="Publish now"
                      onClick={() => transition(story, "PUBLISHED")}
                      pending={pending}
                      storyId={story.id}
                    />
                    <label className="block rounded-2xl border border-border p-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Publish later
                      <input
                        aria-label={`Schedule ${story.title}`}
                        className="mt-2 h-10 w-full rounded-xl border border-border bg-card px-2 text-xs font-semibold normal-case tracking-normal text-foreground"
                        onChange={(event) =>
                          setScheduledAt((value) => ({
                            ...value,
                            [story.id]: event.target.value,
                          }))
                        }
                        type="datetime-local"
                        value={scheduledAt[story.id] ?? ""}
                      />
                    </label>
                    <ActionButton
                      icon={CalendarClock}
                      label="Schedule publication"
                      onClick={() => {
                        const value = scheduledAt[story.id];
                        if (!value || new Date(value) <= new Date()) {
                          setError("Choose a future publication date.");
                          return;
                        }
                        void transition(story, "SCHEDULED", false, value);
                      }}
                      pending={pending}
                      storyId={story.id}
                    />
                  </>
                ) : null}
                {story.status === "SCHEDULED" ? (
                  <>
                    <p className="rounded-2xl bg-muted px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground">
                      Scheduled{" "}
                      {story.scheduledAt
                        ? new Intl.DateTimeFormat("en", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(story.scheduledAt))
                        : ""}
                    </p>
                    <ActionButton
                      icon={Eye}
                      label="Publish now"
                      onClick={() => transition(story, "PUBLISHED")}
                      pending={pending}
                      storyId={story.id}
                    />
                  </>
                ) : null}
                {story.status === "PUBLISHED" ? (
                  <>
                    <Button
                      asChild
                      className="w-full"
                      size="sm"
                      variant="secondary"
                    >
                      <a href={`/stories?story=${story.slug}`} target="_blank">
                        <Eye className="h-4 w-4" /> Open live Story
                      </a>
                    </Button>
                    <ActionButton
                      danger
                      icon={XCircle}
                      label="Remove"
                      onClick={() => transition(story, "REMOVED", true)}
                      pending={pending}
                      storyId={story.id}
                    />
                  </>
                ) : null}
                <label className="flex items-center justify-between rounded-2xl border border-border px-3 py-2 text-xs font-bold">
                  Featured
                  <input
                    checked={story.isFeatured}
                    onChange={(event) =>
                      void request(`/api/admin/stories/${story.id}`, "PATCH", {
                        status: story.status,
                        isFeatured: event.target.checked,
                        isInstitutional: story.isInstitutional,
                        qualityScore: story.qualityScore,
                      })
                    }
                    type="checkbox"
                  />
                </label>
                <label className="flex items-center justify-between rounded-2xl border border-border px-3 py-2 text-xs font-bold">
                  Institutional
                  <input
                    checked={story.isInstitutional}
                    onChange={(event) =>
                      void request(`/api/admin/stories/${story.id}`, "PATCH", {
                        status: story.status,
                        isFeatured: story.isFeatured,
                        isInstitutional: event.target.checked,
                        qualityScore: story.qualityScore,
                      })
                    }
                    type="checkbox"
                  />
                </label>
              </div>
            </Card>
          ))}
          {!stories.length ? (
            <Card className="py-16 text-center text-sm text-muted-foreground">
              No Stories match this moderation view.
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "categories" ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card>
            <h2 className="font-black">Create a Story category</h2>
            <form
              className="mt-4 space-y-3"
              onSubmit={async (event) => {
                event.preventDefault();
                const ok = await request(
                  "/api/admin/stories/categories",
                  "POST",
                  {
                    ...category,
                    icon: category.icon || null,
                    description: category.description || null,
                    order: categories.length * 10 + 10,
                    isActive: true,
                  },
                );
                if (ok) {
                  setCategory({
                    name: "",
                    slug: "",
                    icon: "",
                    description: "",
                  });
                }
              }}
            >
              <input
                className="h-11 w-full rounded-2xl border border-border bg-transparent px-4 text-sm"
                onChange={(event) =>
                  setCategory((value) => ({
                    ...value,
                    name: event.target.value,
                    slug: event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, ""),
                  }))
                }
                placeholder="Category name"
                required
                value={category.name}
              />
              <input
                className="h-11 w-full rounded-2xl border border-border bg-transparent px-4 text-sm"
                onChange={(event) =>
                  setCategory((value) => ({
                    ...value,
                    icon: event.target.value,
                  }))
                }
                placeholder="Icon · optional"
                value={category.icon}
              />
              <textarea
                className="min-h-24 w-full rounded-2xl border border-border bg-transparent p-4 text-sm"
                onChange={(event) =>
                  setCategory((value) => ({
                    ...value,
                    description: event.target.value,
                  }))
                }
                placeholder="Purpose of this category"
                value={category.description}
              />
              <Button disabled={Boolean(pending)} type="submit">
                <Plus className="h-4 w-4" /> Create category
              </Button>
            </form>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2">
            {categories.map((item) => (
              <Card key={item.id}>
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{item.icon ?? "◈"}</span>
                  <span className="rounded-full bg-muted px-2 py-1 text-[9px] font-black">
                    {item._count.stories} Stories
                  </span>
                </div>
                <h3 className="mt-4 font-black">{item.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  /{item.slug}
                </p>
                <label className="mt-4 flex items-center justify-between text-xs font-bold">
                  Active in publishing
                  <input
                    checked={item.isActive}
                    onChange={(event) =>
                      void request(
                        `/api/admin/stories/categories/${item.id}`,
                        "PATCH",
                        { isActive: event.target.checked },
                      )
                    }
                    type="checkbox"
                  />
                </label>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "creators" ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {creators.map((creator) => (
            <Card key={creator.id}>
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-kondo-mint text-sm font-black text-kondo-forest">
                  {creator.firstName[0]}
                  {creator.lastName[0]}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {creator._count.stories} Stories
                </span>
              </div>
              <h3 className="mt-4 font-black">
                {creator.firstName} {creator.lastName}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                @{creator.username ?? creator.id.slice(0, 8)}
              </p>
              <select
                className="mt-4 h-10 w-full rounded-2xl border border-border bg-card px-3 text-xs font-bold"
                onChange={(event) => {
                  const reason = window.prompt(
                    "Why is this creator status changing?",
                  );
                  if (!reason) return;
                  void request(
                    `/api/admin/stories/creators/${creator.id}`,
                    "PATCH",
                    { status: event.target.value, reason },
                  );
                }}
                value={creator.storyCreatorStatus}
              >
                <option value="STANDARD">Standard · moderation required</option>
                <option value="AMBASSADOR">Kondo ambassador</option>
                <option value="APPROVED_CREATOR">Approved creator</option>
                <option value="TRUSTED_CREATOR">Trusted Creator</option>
                <option value="SUSPENDED">Publishing suspended</option>
              </select>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  pending,
  storyId,
  danger = false,
}: {
  icon: typeof CheckCircle2;
  label: string;
  onClick: () => void;
  pending: string;
  storyId: string;
  danger?: boolean;
}) {
  const busy = pending.includes(storyId);
  return (
    <Button
      className="w-full"
      disabled={Boolean(pending)}
      onClick={onClick}
      size="sm"
      type="button"
      variant={danger ? "danger" : "secondary"}
    >
      {busy ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
