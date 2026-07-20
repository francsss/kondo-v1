"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function CityHubEditor({
  hubId,
  status,
  version,
  draft,
}: {
  hubId: string;
  status: "DRAFT" | "REVIEW" | "PUBLISHED";
  version: number;
  draft: unknown;
}) {
  const router = useRouter();
  const [value, setValue] = useState(() => JSON.stringify(draft, null, 2));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const editable = status === "DRAFT";

  async function save() {
    setError("");
    setSaved(false);
    let payload: unknown;
    try {
      payload = JSON.parse(value);
    } catch {
      setError("Content is not valid JSON. Fix the syntax and try again.");
      return;
    }
    setPending(true);
    const response = await fetch(`/api/admin/city-hubs/${hubId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, expectedVersion: version }),
    });
    const data = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(data?.error ?? "Could not save the draft.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <Card className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-black text-kondo-ink dark:text-white">
          Draft content
        </h2>
        <span className="text-xs text-slate-400">Version {version}</span>
      </div>
      {!editable ? (
        <p className="mt-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
          This hub is in {status}. Send it back to draft to edit its content.
          The live published version stays unchanged until you re-publish.
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-400">
          Structured city payload (ExploreCity shape). It is validated on save,
          so publishing can never expose malformed content.
        </p>
      )}
      <textarea
        aria-label="City hub JSON content"
        className="mt-4 h-[440px] w-full rounded-2xl border border-slate-200 bg-transparent p-3 font-mono text-xs leading-relaxed dark:border-white/10"
        disabled={!editable || pending}
        onChange={(event) => setValue(event.target.value)}
        spellCheck={false}
        value={value}
      />
      {error ? (
        <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-300">
          Draft saved.
        </p>
      ) : null}
      <div className="mt-4">
        <Button disabled={!editable || pending} onClick={save} type="button">
          {pending ? "Saving…" : "Save draft"}
        </Button>
      </div>
    </Card>
  );
}
