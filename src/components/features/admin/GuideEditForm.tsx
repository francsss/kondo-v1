"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImagePlus, X } from "lucide-react";
import {
  SaveButtonLabel,
  SaveFeedback,
  type SaveState,
} from "@/components/forms/SaveFeedback";
import { UnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MediaImage } from "@/components/ui/MediaImage";
import { uploadPublicImage } from "@/lib/client-media";

const categories = [
  "BEFORE_DEPARTURE",
  "ARRIVAL",
  "RESIDENCY",
  "DAILY_LIFE",
  "MONEY",
  "TRANSPORT",
  "HEALTH",
  "UNIVERSITY",
];

export function GuideEditForm({
  guideId,
  initial,
}: {
  guideId: string;
  initial: {
    title: string;
    summary: string;
    category: string;
    estimatedMinutes: number;
    featured: boolean;
    coverMediaId: string | null;
  };
}) {
  const router = useRouter();
  const [featured, setFeatured] = useState(initial.featured);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [cover, setCover] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState("saving");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const title = String(form.get("title") ?? "");
      const coverMediaId = cover
        ? await uploadPublicImage(cover, "GUIDE_COVER", `${title} guide cover`)
        : removeCover
          ? null
          : undefined;
      const response = await fetch(`/api/admin/guides/${guideId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          summary: form.get("summary"),
          category: form.get("category"),
          estimatedMinutes: Number(form.get("estimatedMinutes")),
          featured,
          coverMediaId,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Could not save.");
      setSaveState("success");
      setMessage("Guide details saved to the database.");
      setIsDirty(false);
      setCover(null);
      setRemoveCover(false);
      router.refresh();
    } catch (caught) {
      setSaveState("error");
      setMessage(caught instanceof Error ? caught.message : "Could not save.");
    }
  }

  return (
    <Card>
      <h2 className="font-black text-kondo-ink dark:text-white">Details</h2>
      <form
        className="mt-4 space-y-4"
        onChange={() => {
          setIsDirty(true);
          if (saveState === "success") setSaveState("idle");
        }}
        onSubmit={submit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Title</span>
            <input
              className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
              defaultValue={initial.title}
              maxLength={120}
              minLength={4}
              name="title"
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Category</span>
            <select
              className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
              defaultValue={initial.category}
              name="category"
              required
            >
              {categories.map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Summary</span>
          <textarea
            className="min-h-24 w-full rounded-2xl border border-slate-200 bg-transparent p-3 text-sm dark:border-white/10"
            defaultValue={initial.summary}
            maxLength={500}
            minLength={10}
            name="summary"
            required
          />
        </label>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block max-w-xs">
            <span className="mb-2 block text-sm font-bold">
              Estimated minutes
            </span>
            <input
              className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
              defaultValue={initial.estimatedMinutes}
              max={240}
              min={1}
              name="estimatedMinutes"
              required
              type="number"
            />
          </label>
          <label className="flex h-11 items-center gap-3 text-sm font-semibold">
            <input
              checked={featured}
              onChange={(event) => {
                setFeatured(event.target.checked);
                setIsDirty(true);
              }}
              type="checkbox"
            />
            Featured
          </label>
        </div>
        {initial.coverMediaId && !removeCover ? (
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
            <MediaImage
              alt={`${initial.title} guide cover`}
              className="h-40 w-full object-cover"
              height={320}
              mediaId={initial.coverMediaId}
              sizes="(min-width: 1024px) 800px, 90vw"
              width={800}
            />
            <Button
              aria-label="Remove guide cover"
              className="absolute right-3 top-3"
              onClick={() => {
                setRemoveCover(true);
                setIsDirty(true);
              }}
              size="icon"
              type="button"
              variant="secondary"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-300 p-4 text-sm dark:border-white/15">
          <ImagePlus className="h-5 w-5 text-kondo-green" />
          <span className="min-w-0 flex-1 truncate">
            {cover?.name ??
              (initial.coverMediaId
                ? "Replace guide cover"
                : "Add guide cover")}
          </span>
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              setCover(event.target.files?.[0] ?? null);
              setRemoveCover(false);
              setIsDirty(true);
            }}
            type="file"
          />
        </label>
        <Button disabled={saveState === "saving" || !isDirty} type="submit">
          <SaveButtonLabel idleLabel="Save details" state={saveState} />
        </Button>
      </form>
      <SaveFeedback message={message} state={saveState} />
      <UnsavedChangesGuard isDirty={isDirty} />
    </Card>
  );
}
