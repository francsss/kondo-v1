"use client";

import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function AnswerComposer({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch(`/api/questions/${questionId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok)
      return setError(data.error ?? "We couldn’t publish that answer.");
    setBody("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm" type="button">
        Write an answer
      </Button>
    );
  }

  return (
    <form
      className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50/50 p-5 dark:border-emerald-400/15 dark:bg-emerald-400/5"
      onSubmit={submit}
    >
      <label className="block text-sm font-black">Your answer</label>
      <textarea
        className="mt-3 min-h-32 w-full resize-y rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 outline-none focus:border-kondo-green dark:border-white/10 dark:bg-[#14201d]"
        minLength={10}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Share a clear answer from your experience…"
        required
        value={body}
      />
      {error ? (
        <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex justify-end gap-2">
        <Button
          onClick={() => setOpen(false)}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
        <Button disabled={loading} size="sm" type="submit">
          <Send className="h-4 w-4" /> {loading ? "Publishing…" : "Publish"}
        </Button>
      </div>
    </form>
  );
}
