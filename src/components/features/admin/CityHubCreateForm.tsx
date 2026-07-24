"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function CityHubCreateForm({
  cityId,
  cityName,
}: {
  cityId: string;
  cityName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/city-hubs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Could not prepare this city workspace.");
        return;
      }
      router.push(`/admin/city-hubs/${data.hub.id}`);
    } catch {
      setError("Could not prepare this city workspace. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="min-w-0" onSubmit={submit}>
      <Button
        aria-label={`Prepare ${cityName} content workspace`}
        className="w-full sm:w-auto"
        disabled={pending}
        size="sm"
        type="submit"
      >
        <Plus className="h-4 w-4" />
        {pending ? "Preparing…" : "Add content"}
      </Button>
      <p
        aria-live="polite"
        className="mt-2 max-w-64 text-xs font-semibold text-red-600 dark:text-red-300"
      >
        {error}
      </p>
    </form>
  );
}
