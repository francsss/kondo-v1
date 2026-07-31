"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function RoommateProfileComposer({
  cities,
  profile,
}: {
  cities: Array<{ id: string; name: string }>;
  profile: {
    version: number;
    cityId: string;
    moveInDate: string;
    stayDurationMonths: number | null;
    budgetMaximum: number;
    preferredHousingTypes: string[];
    currentHousingSituation: string | null;
    languages: string[];
    sleepSchedule: string | null;
    routine: string | null;
    cleanlinessPreference: string | null;
    introduction: string;
  } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/housing/roommate-profile", {
      method: profile ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        active: true,
        visibility: "MEMBERS_ONLY",
        cityId: form.get("cityId"),
        universityId: null,
        moveInDate: form.get("moveInDate"),
        stayDurationMonths: form.get("stayDurationMonths")
          ? Number(form.get("stayDurationMonths"))
          : null,
        budgetMinimumMinor: null,
        budgetMaximumMinor: Number(form.get("budgetMaximum")) * 100,
        currency: "CNY",
        preferredHousingTypes: form.getAll("preferredHousingTypes"),
        currentHousingSituation: form.get("currentHousingSituation") || null,
        languages: String(form.get("languages") || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        sleepSchedule: form.get("sleepSchedule") || null,
        routine: form.get("routine") || null,
        cleanlinessPreference: form.get("cleanlinessPreference") || null,
        cookingFrequency: null,
        smokingPreference: "NOT_SPECIFIED",
        petPreference: "NOT_SPECIFIED",
        guestPreference: null,
        noisePreference: null,
        genderPreference: null,
        introduction: form.get("introduction"),
        allowInterests: true,
        showUniversity: true,
        showApproximateLocation: true,
        expectedVersion: profile?.version,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error ?? "Could not save your roommate profile.");
      setBusy(false);
      return;
    }
    setBusy(false);
    setOpen(false);
    router.refresh();
  }
  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="secondary">
        {profile ? "Update my profile" : "Create roommate profile"}
      </Button>
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
          defaultValue={profile?.cityId ?? ""}
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
        Move-in date
        <input
          className="h-11 rounded-2xl border border-border bg-background px-3"
          defaultValue={profile?.moveInDate}
          name="moveInDate"
          required
          type="date"
        />
      </label>
      <label className="grid gap-2 text-sm font-bold">
        Maximum budget (CNY)
        <input
          className="h-11 rounded-2xl border border-border bg-background px-3"
          defaultValue={profile?.budgetMaximum}
          min="1"
          name="budgetMaximum"
          required
          type="number"
        />
      </label>
      <label className="grid gap-2 text-sm font-bold">
        Stay length (months)
        <input
          className="h-11 rounded-2xl border border-border bg-background px-3"
          defaultValue={profile?.stayDurationMonths ?? undefined}
          min="1"
          name="stayDurationMonths"
          type="number"
        />
      </label>
      <label className="grid gap-2 text-sm font-bold">
        Languages (comma separated)
        <input
          className="h-11 rounded-2xl border border-border bg-background px-3"
          defaultValue={profile?.languages.join(", ")}
          name="languages"
          placeholder="English, French"
        />
      </label>
      <label className="grid gap-2 text-sm font-bold">
        Current situation
        <input
          className="h-11 rounded-2xl border border-border bg-background px-3"
          defaultValue={profile?.currentHousingSituation ?? undefined}
          maxLength={160}
          name="currentHousingSituation"
        />
      </label>
      <label className="grid gap-2 text-sm font-bold">
        Sleep schedule
        <select
          className="h-11 rounded-2xl border border-border bg-background px-3"
          defaultValue={profile?.sleepSchedule ?? ""}
          name="sleepSchedule"
        >
          <option value="">Not specified</option>
          <option value="EARLY">Early</option>
          <option value="FLEXIBLE">Flexible</option>
          <option value="LATE">Late</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-bold">
        Cleanliness
        <select
          className="h-11 rounded-2xl border border-border bg-background px-3"
          defaultValue={profile?.cleanlinessPreference ?? ""}
          name="cleanlinessPreference"
        >
          <option value="">Not specified</option>
          <option value="RELAXED">Relaxed</option>
          <option value="BALANCED">Balanced</option>
          <option value="VERY_TIDY">Very tidy</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-bold">
        Routine
        <select
          className="h-11 rounded-2xl border border-border bg-background px-3"
          defaultValue={profile?.routine ?? ""}
          name="routine"
        >
          <option value="">Not specified</option>
          <option value="MOSTLY_HOME">Mostly at home</option>
          <option value="BALANCED">Balanced</option>
          <option value="MOSTLY_AWAY">Mostly away</option>
        </select>
      </label>
      <fieldset>
        <legend className="text-sm font-bold">Preferred housing</legend>
        <label className="mt-3 block text-sm">
          <input
            defaultChecked={
              !profile || profile.preferredHousingTypes.includes("PRIVATE_ROOM")
            }
            name="preferredHousingTypes"
            type="checkbox"
            value="PRIVATE_ROOM"
          />{" "}
          Private room
        </label>
        <label className="mt-2 block text-sm">
          <input
            defaultChecked={profile?.preferredHousingTypes.includes(
              "SHARED_ROOM",
            )}
            name="preferredHousingTypes"
            type="checkbox"
            value="SHARED_ROOM"
          />{" "}
          Shared room
        </label>
      </fieldset>
      <label className="grid gap-2 text-sm font-bold sm:col-span-2">
        Short introduction
        <textarea
          className="min-h-28 rounded-2xl border border-border bg-background p-3"
          defaultValue={profile?.introduction}
          maxLength={800}
          minLength={20}
          name="introduction"
          required
        />
      </label>
      {error ? (
        <p className="text-sm font-bold text-destructive sm:col-span-2">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2 sm:col-span-2">
        <Button disabled={busy} type="submit">
          {busy ? "Saving…" : "Save profile"}
        </Button>
        <Button onClick={() => setOpen(false)} type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </form>
  );
}
