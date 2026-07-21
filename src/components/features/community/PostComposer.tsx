"use client";

import { ImagePlus, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { uploadPublicImage } from "@/lib/client-media";

type CommunityOption = {
  id: string;
  name: string;
  icon: string | null;
  canAnnounce?: boolean;
};

export function PostComposer({
  communities,
  defaultCommunityId,
  triggerLabel = "Create a post",
  triggerVariant = "button",
}: {
  communities: CommunityOption[];
  defaultCommunityId?: string;
  triggerLabel?: string;
  triggerVariant?: "button" | "composer";
}) {
  const router = useRouter();
  const filesRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState("DISCUSSION");
  const [communityId, setCommunityId] = useState(
    defaultCommunityId ?? communities[0]?.id ?? "",
  );
  const [images, setImages] = useState<File[]>([]);
  const canAnnounce = Boolean(
    communities.find((community) => community.id === communityId)?.canAnnounce,
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const mediaIds = [];
      for (const [index, image] of images.entries()) {
        mediaIds.push(
          await uploadPublicImage(
            image,
            "POST_IMAGE",
            `${String(form.get("title") || "Community post")} image ${index + 1}`,
          ),
        );
      }
      const response = await fetch("/api/posts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communityId,
          type,
          title: form.get("title") || undefined,
          content: form.get("content"),
          mediaIds,
          eventAt:
            type === "EVENT" ? form.get("eventAt") || undefined : undefined,
          eventEndsAt:
            type === "EVENT" ? form.get("eventEndsAt") || undefined : undefined,
          eventCapacity:
            type === "EVENT"
              ? form.get("eventCapacity") || undefined
              : undefined,
          eventLocation:
            type === "EVENT"
              ? form.get("eventLocation") || undefined
              : undefined,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "We couldn’t publish that post.");
      }
      setOpen(false);
      setImages([]);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We couldn’t publish that post.",
      );
    } finally {
      setLoading(false);
    }
  }

  function selectImages(files: FileList | null) {
    const next = Array.from(files ?? []).slice(0, 4);
    setImages(next);
    setError(
      (files?.length ?? 0) > 4 ? "A post can contain up to four images." : "",
    );
  }

  if (!communities.length) return null;

  return (
    <>
      {triggerVariant === "composer" ? (
        <button
          className="flex h-11 w-full items-center rounded-full bg-slate-100 px-4 text-left text-sm text-muted-foreground transition hover:bg-slate-200/70 dark:bg-white/5 dark:hover:bg-white/10"
          onClick={() => setOpen(true)}
          type="button"
        >
          {triggerLabel}
        </button>
      ) : (
        <Button onClick={() => setOpen(true)} size="lg" type="button">
          {triggerLabel}
        </Button>
      )}

      {open ? (
        <div
          aria-labelledby="post-composer-title"
          aria-modal="true"
          className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-overlay/45 p-4 backdrop-blur-sm"
          role="dialog"
        >
          <div className="my-6 w-full max-w-xl rounded-4xl border border-border bg-card p-6 text-card-foreground shadow-2xl sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-kondo-green">
                  Share with your community
                </p>
                <h2
                  className="mt-1 text-2xl font-black text-kondo-ink dark:text-white"
                  id="post-composer-title"
                >
                  Create a post
                </h2>
              </div>
              <Button
                aria-label="Close post composer"
                onClick={() => setOpen(false)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={submit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-bold">
                    Community
                  </span>
                  <select
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
                    name="communityId"
                    onChange={(event) => setCommunityId(event.target.value)}
                    value={communityId}
                  >
                    {communities.map((community) => (
                      <option key={community.id} value={community.id}>
                        {community.icon} {community.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-2 block text-sm font-bold">
                    Post type
                  </span>
                  <select
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
                    name="type"
                    onChange={(event) => setType(event.target.value)}
                    value={type}
                  >
                    <option value="DISCUSSION">Discussion</option>
                    <option value="QUESTION">Question</option>
                    <option value="EVENT">Event</option>
                    {canAnnounce ? (
                      <option value="ANNOUNCEMENT">Announcement</option>
                    ) : null}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">
                  {type === "EVENT" || type === "ANNOUNCEMENT"
                    ? "Title"
                    : "Title (optional)"}
                </span>
                <input
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-sm outline-none focus:border-kondo-green dark:border-white/10"
                  maxLength={180}
                  minLength={
                    type === "EVENT" || type === "ANNOUNCEMENT" ? 3 : undefined
                  }
                  name="title"
                  placeholder="Give people the useful part up front"
                  required={type === "EVENT" || type === "ANNOUNCEMENT"}
                />
              </label>
              {type === "EVENT" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Starts"
                    name="eventAt"
                    required
                    type="datetime-local"
                  />
                  <Field
                    label="Ends (optional)"
                    name="eventEndsAt"
                    type="datetime-local"
                  />
                  <Field label="Location" name="eventLocation" required />
                  <Field
                    label="Capacity (optional)"
                    name="eventCapacity"
                    type="number"
                  />
                </div>
              ) : null}
              <label className="block">
                <span className="mb-2 block text-sm font-bold">Your post</span>
                <textarea
                  className="min-h-36 w-full resize-y rounded-2xl border border-slate-200 bg-transparent p-4 text-sm leading-6 outline-none focus:border-kondo-green dark:border-white/10"
                  maxLength={10_000}
                  minLength={3}
                  name="content"
                  placeholder="Ask a question, share an update, or make the next student’s day easier…"
                  required
                />
              </label>
              <input
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                multiple
                onChange={(event) => selectImages(event.target.files)}
                ref={filesRef}
                type="file"
              />
              <button
                className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-slate-300 p-4 text-left text-sm text-muted-foreground transition hover:border-kondo-green dark:border-white/15"
                onClick={() => filesRef.current?.click()}
                type="button"
              >
                <ImagePlus className="h-5 w-5 text-kondo-green" />
                {images.length
                  ? `${images.length} image${images.length === 1 ? "" : "s"} selected`
                  : "Add up to four images"}
              </button>
              {type === "EVENT" && !canAnnounce ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  Events submitted by members require validation from community
                  staff before publication.
                </p>
              ) : null}
              {error ? (
                <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end">
                <Button disabled={loading} type="submit">
                  <Send className="h-4 w-4" />
                  {loading ? "Publishing…" : "Publish"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <input
        className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-sm outline-none focus:border-kondo-green dark:border-white/10"
        min={type === "number" ? 1 : undefined}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}
