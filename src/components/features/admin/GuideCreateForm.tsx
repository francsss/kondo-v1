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

export function GuideCreateForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/guides", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        summary: form.get("summary"),
        category: form.get("category"),
        estimatedMinutes: Number(form.get("estimatedMinutes")),
      }),
    });
    const data = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(data?.error ?? "Could not create the guide.");
      return;
    }
    router.push(`/admin/guides/${data.guide.id}`);
  }

  return (
    <Card className="mt-6">
      <h2 className="font-black text-kondo-ink dark:text-white">
        New guide
      </h2>
      <form className="mt-4 space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Title</span>
            <input
              className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
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
            maxLength={500}
            minLength={10}
            name="summary"
            required
          />
        </label>
        <label className="block max-w-xs">
          <span className="mb-2 block text-sm font-bold">
            Estimated minutes
          </span>
          <input
            className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
            defaultValue={10}
            max={240}
            min={1}
            name="estimatedMinutes"
            required
            type="number"
          />
        </label>
        {error ? (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
            {error}
          </p>
        ) : null}
        <Button disabled={pending} type="submit">
          {pending ? "Creating…" : "Create draft guide"}
        </Button>
      </form>
    </Card>
  );
}
