"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function GuidePublishActions({
  guideId,
  published,
  stepCount,
}: {
  guideId: string;
  published: boolean;
  stepCount: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function togglePublish() {
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/admin/guides/${guideId}/publish`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !published }),
    });
    const data = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setMessage(data?.error ?? "Could not update publish state.");
      return;
    }
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this draft guide? This cannot be undone.")) return;
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/admin/guides/${guideId}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setMessage(data?.error ?? "Could not delete this guide.");
      return;
    }
    router.push("/admin/guides");
    router.refresh();
  }

  return (
    <Card>
      <h2 className="font-black text-kondo-ink dark:text-white">
        Publishing
      </h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
        {published
          ? "Live in the Student Hub guide library."
          : stepCount
            ? "Ready to publish."
            : "Add at least one step before publishing."}
      </p>
      {message ? (
        <p className="mt-3 text-xs text-slate-400" role="status">
          {message}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          disabled={pending || (!published && stepCount === 0)}
          onClick={togglePublish}
          type="button"
          variant={published ? "secondary" : "primary"}
        >
          {pending ? "Saving…" : published ? "Unpublish" : "Publish"}
        </Button>
        {!published ? (
          <Button disabled={pending} onClick={remove} type="button" variant="danger">
            Delete draft
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
