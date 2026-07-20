"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

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
  };
}) {
  const router = useRouter();
  const [featured, setFeatured] = useState(initial.featured);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/guides/${guideId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        summary: form.get("summary"),
        category: form.get("category"),
        estimatedMinutes: Number(form.get("estimatedMinutes")),
        featured,
      }),
    });
    const data = await response.json().catch(() => null);
    setPending(false);
    setMessage(response.ok ? "Saved." : (data?.error ?? "Could not save."));
    if (response.ok) router.refresh();
  }

  return (
    <Card>
      <h2 className="font-black text-kondo-ink dark:text-white">Details</h2>
      <form className="mt-4 space-y-4" onSubmit={submit}>
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
              onChange={(event) => setFeatured(event.target.checked)}
              type="checkbox"
            />
            Featured
          </label>
        </div>
        {message ? (
          <p className="text-xs text-slate-400" role="status">
            {message}
          </p>
        ) : null}
        <Button disabled={pending} type="submit">
          {pending ? "Saving…" : "Save details"}
        </Button>
      </form>
    </Card>
  );
}
