"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type RegistryOption = { slug: string; name: string };

export function CityHubCreateForm({
  registryCities,
}: {
  registryCities: RegistryOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [seed, setSeed] = useState(registryCities.length > 0);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/city-hubs", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: String(form.get("slug") ?? "").trim(),
        name: String(form.get("name") ?? "").trim(),
        seedFromRegistry: seed,
      }),
    });
    const data = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(data?.error ?? "Could not create the city hub.");
      return;
    }
    router.push(`/admin/city-hubs/${data.hub.id}`);
  }

  return (
    <Card className="mt-6">
      <h2 className="font-black text-kondo-ink dark:text-white">
        New city hub
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        Seed from an existing registry city to start with its full content, or
        create an empty draft to build from scratch.
      </p>
      <form className="mt-4 space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Slug</span>
            <input
              className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
              maxLength={80}
              name="slug"
              pattern="[a-z0-9-]+"
              placeholder="jiaxing"
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">City name</span>
            <input
              className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
              maxLength={120}
              name="name"
              placeholder="Jiaxing"
              required
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={seed}
            onChange={(event) => setSeed(event.target.checked)}
            type="checkbox"
          />
          <span className="font-semibold">
            Seed draft from the matching registry city
          </span>
        </label>
        {registryCities.length ? (
          <p className="text-xs text-slate-400">
            Registry cities available to seed from:{" "}
            {registryCities.map((c) => c.slug).join(", ")}.
          </p>
        ) : null}
        {error ? (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
            {error}
          </p>
        ) : null}
        <Button disabled={pending} type="submit">
          {pending ? "Creating…" : "Create draft city hub"}
        </Button>
      </form>
    </Card>
  );
}
