"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function HousingRequestComposer({
  cities,
}: {
  cities: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const response = await fetch("/api/housing/requests", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cityId: form.get("cityId"),
        preferredDistrict: form.get("preferredDistrict") || null,
        universityId: null,
        moveInDate: form.get("moveInDate"),
        stayDurationMonths: form.get("stayDurationMonths")
          ? Number(form.get("stayDurationMonths"))
          : null,
        minimumBudgetMinor: null,
        maximumBudgetMinor: Number(form.get("maximumBudget")) * 100,
        currency: "CNY",
        preferredListingTypes: form.getAll("preferredListingTypes"),
        roomPreference: null,
        roommateOpen: form.get("roommateOpen") === "on",
        requiredAmenities: [],
        preferredCommute: null,
        description: form.get("description"),
        contactPreference: "KONDO_MESSAGE",
        visibility: "MEMBERS_ONLY",
        expiresAt: expiresAt.toISOString(),
      }),
    });
    const created = await response.json().catch(() => null);
    if (!response.ok) {
      setError(created?.error ?? "Could not create your request.");
      setBusy(false);
      return;
    }
    const publish = await fetch(`/api/housing/requests/${created.id}/publish`, {
      method: "POST",
      credentials: "include",
    });
    if (!publish.ok) {
      const detail = await publish.json().catch(() => null);
      setError(
        detail?.error ??
          "The draft was saved, but it could not be published yet.",
      );
      setBusy(false);
      return;
    }
    setOpen(false);
    setBusy(false);
    router.refresh();
  }
  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>Post a Housing request</Button>
    );
  }
  return (
    <form
      className="mt-5 grid gap-4 rounded-3xl border border-border bg-card p-5 sm:grid-cols-2"
      onSubmit={submit}
    >
      <label className="grid gap-2 text-sm font-bold">
        City
        <select
          className="h-11 rounded-2xl border border-border bg-background px-3"
          name="cityId"
          required
        >
          <option value="">Choose a city</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-bold">
        Preferred district
        <input
          className="h-11 rounded-2xl border border-border bg-background px-3"
          name="preferredDistrict"
        />
      </label>
      <label className="grid gap-2 text-sm font-bold">
        Move-in date
        <input
          className="h-11 rounded-2xl border border-border bg-background px-3"
          name="moveInDate"
          required
          type="date"
        />
      </label>
      <label className="grid gap-2 text-sm font-bold">
        Maximum monthly budget (CNY)
        <input
          className="h-11 rounded-2xl border border-border bg-background px-3"
          min="1"
          name="maximumBudget"
          required
          type="number"
        />
      </label>
      <label className="grid gap-2 text-sm font-bold">
        Stay length (months)
        <input
          className="h-11 rounded-2xl border border-border bg-background px-3"
          min="1"
          name="stayDurationMonths"
          type="number"
        />
      </label>
      <fieldset>
        <legend className="text-sm font-bold">Home types</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            ["PRIVATE_ROOM", "Private room"],
            ["SHARED_ROOM", "Shared room"],
            ["STUDIO", "Studio"],
            ["ENTIRE_APARTMENT", "Apartment"],
          ].map(([value, label], index) => (
            <label
              className="rounded-full border border-border px-3 py-2 text-xs font-bold"
              key={value}
            >
              <input
                className="mr-2"
                defaultChecked={index === 0}
                name="preferredListingTypes"
                type="checkbox"
                value={value}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-2 text-sm font-bold sm:col-span-2">
        What are you looking for?
        <textarea
          className="min-h-28 rounded-2xl border border-border bg-background p-3"
          maxLength={1200}
          minLength={20}
          name="description"
          required
        />
      </label>
      <label className="flex items-center gap-3 text-sm font-bold sm:col-span-2">
        <input name="roommateOpen" type="checkbox" />I am open to finding a
        roommate
      </label>
      {error ? (
        <p className="text-sm font-bold text-destructive sm:col-span-2">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2 sm:col-span-2">
        <Button disabled={busy} type="submit">
          {busy ? "Publishing…" : "Publish request"}
        </Button>
        <Button onClick={() => setOpen(false)} type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </form>
  );
}
