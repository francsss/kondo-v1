"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Step = {
  id: string;
  order: number;
  title: string;
  content: string;
  actionUrl: string | null;
  _count: { progress: number };
};

function StepForm({
  guideId,
  step,
  nextOrder,
  onSaved,
}: {
  guideId: string;
  step?: Step;
  nextOrder: number;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const url = step
      ? `/api/admin/guides/${guideId}/steps/${step.id}`
      : `/api/admin/guides/${guideId}/steps`;
    const response = await fetch(url, {
      method: step ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order: Number(form.get("order")),
        title: form.get("title"),
        content: form.get("content"),
        actionUrl: form.get("actionUrl") || null,
      }),
    });
    const data = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(data?.error ?? "Could not save this step.");
      return;
    }
    if (!step) event.currentTarget.reset();
    onSaved();
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-[100px_minmax(0,1fr)]">
        <label className="block">
          <span className="mb-1 block text-xs font-bold">Order</span>
          <input
            className="h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
            defaultValue={step?.order ?? nextOrder}
            max={200}
            min={0}
            name="order"
            required
            type="number"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold">Step title</span>
          <input
            className="h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
            defaultValue={step?.title}
            maxLength={140}
            minLength={3}
            name="title"
            required
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-bold">Content</span>
        <textarea
          className="min-h-20 w-full rounded-xl border border-slate-200 bg-transparent p-3 text-sm dark:border-white/10"
          defaultValue={step?.content}
          maxLength={5000}
          minLength={10}
          name="content"
          required
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-bold">
          Action link (optional)
        </span>
        <input
          className="h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
          defaultValue={step?.actionUrl ?? ""}
          name="actionUrl"
          placeholder="https://…"
          type="url"
        />
      </label>
      {error ? (
        <p className="text-xs font-semibold text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <Button disabled={pending} size="sm" type="submit">
        {pending ? "Saving…" : step ? "Save step" : "Add step"}
      </Button>
    </form>
  );
}

export function GuideStepManager({
  guideId,
  steps,
}: {
  guideId: string;
  steps: Step[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function removeStep(step: Step) {
    if (step._count.progress > 0) {
      setMessage(
        "This step has recorded member progress and cannot be deleted.",
      );
      return;
    }
    if (!confirm(`Delete step "${step.title}"?`)) return;
    const response = await fetch(
      `/api/admin/guides/${guideId}/steps/${step.id}`,
      { method: "DELETE", credentials: "include" },
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(data?.error ?? "Could not delete this step.");
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <h2 className="font-black text-kondo-ink dark:text-white">
        Steps ({steps.length})
      </h2>
      {message ? (
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      <div className="mt-4 space-y-4">
        {steps.map((step) => (
          <div
            className="rounded-2xl border border-slate-200 p-4 dark:border-white/10"
            key={step.id}
          >
            {editingId === step.id ? (
              <StepForm
                guideId={guideId}
                nextOrder={step.order}
                onSaved={() => {
                  setEditingId(null);
                  router.refresh();
                }}
                step={step}
              />
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-kondo-ink dark:text-white">
                      {step.order}. {step.title}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {step.content}
                    </p>
                    {step.actionUrl ? (
                      <a
                        className="mt-1 block text-xs text-kondo-green underline"
                        href={step.actionUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {step.actionUrl}
                      </a>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {step._count.progress} member
                      {step._count.progress === 1 ? "" : "s"} completed
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      onClick={() => setEditingId(step.id)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => removeStep(step)}
                      size="sm"
                      type="button"
                      variant="danger"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
        <p className="mb-3 text-sm font-bold text-kondo-ink dark:text-white">
          Add a step
        </p>
        <StepForm
          guideId={guideId}
          nextOrder={
            steps.length ? Math.max(...steps.map((s) => s.order)) + 1 : 0
          }
          onSaved={() => router.refresh()}
        />
      </div>
    </Card>
  );
}
