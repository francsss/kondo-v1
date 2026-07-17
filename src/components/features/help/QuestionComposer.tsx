"use client";

import { useRouter } from "next/navigation";
import { Plus, Send, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

const categories = [
  "VISA",
  "HOUSING",
  "BANK",
  "UNIVERSITY",
  "SCHOLARSHIP",
  "TRAVEL",
  "HEALTH",
] as const;

export function QuestionComposer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: form.get("category"),
        title: form.get("title"),
        body: form.get("body"),
      }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok)
      return setError(data.error ?? "We couldn’t publish that question.");
    setOpen(false);
    router.push(`/help/${data.question.slug}`);
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button">
        <Plus className="h-4 w-4" /> Ask a question
      </Button>
      {open ? (
        <div
          aria-labelledby="question-composer-title"
          aria-modal="true"
          className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"
          role="dialog"
        >
          <div className="w-full max-w-xl rounded-4xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#14201d] sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-kondo-green">
                  Ask the community
                </p>
                <h2
                  className="mt-1 text-2xl font-black"
                  id="question-composer-title"
                >
                  What do you need help with?
                </h2>
              </div>
              <Button
                aria-label="Close"
                onClick={() => setOpen(false)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={submit}>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">Category</span>
                <select
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
                  name="category"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category[0] + category.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">Question</span>
                <input
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-sm outline-none focus:border-kondo-green dark:border-white/10"
                  maxLength={180}
                  minLength={8}
                  name="title"
                  placeholder="Make the question easy to understand"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">
                  Helpful context
                </span>
                <textarea
                  className="min-h-36 w-full resize-y rounded-2xl border border-slate-200 bg-transparent p-4 text-sm leading-6 outline-none focus:border-kondo-green dark:border-white/10"
                  maxLength={10_000}
                  minLength={20}
                  name="body"
                  placeholder="What have you tried, and where in China are you?"
                  required
                />
              </label>
              {error ? (
                <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end">
                <Button disabled={loading} type="submit">
                  <Send className="h-4 w-4" />{" "}
                  {loading ? "Publishing…" : "Publish question"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
