"use client";

import { ImagePlus, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { uploadPublicImage } from "@/lib/client-media";

type ReferenceOption = { id: string; name: string };

export function CommunityCreateDialog({
  countries,
  cities,
  universities,
}: {
  countries: ReferenceOption[];
  cities: ReferenceOption[];
  universities: ReferenceOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("TOPIC");
  const [cover, setCover] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const name = String(form.get("name") ?? "");
      const coverMediaId = cover
        ? await uploadPublicImage(
            cover,
            "COMMUNITY_COVER",
            `${name} community cover`,
          )
        : undefined;
      const response = await fetch("/api/communities", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: form.get("description"),
          icon: form.get("icon") || undefined,
          type,
          isPrivate: form.get("isPrivate") === "on",
          joinPolicy: form.get("joinPolicy"),
          countryId:
            type === "COUNTRY" ? form.get("countryId") || undefined : undefined,
          cityId: type === "CITY" ? form.get("cityId") || undefined : undefined,
          universityId:
            type === "UNIVERSITY"
              ? form.get("universityId") || undefined
              : undefined,
          coverMediaId,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not create the community.");
      }
      setOpen(false);
      router.push(`/communities/${payload.community.slug}`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not create the community.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button">
        <Plus className="h-4 w-4" /> Create community
      </Button>
      {open ? (
        <div
          aria-labelledby="community-create-title"
          aria-modal="true"
          className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-overlay/45 p-4 backdrop-blur-sm"
          role="dialog"
        >
          <div className="my-6 w-full max-w-2xl rounded-4xl border border-border bg-card p-6 text-card-foreground shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
                  Build a useful place
                </p>
                <h2
                  className="mt-1 text-2xl font-black text-kondo-ink dark:text-white"
                  id="community-create-title"
                >
                  Create a community
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  New communities are reviewed before becoming publicly visible.
                </p>
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
              <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
                <label>
                  <span className="mb-2 block text-sm font-bold">Name</span>
                  <input
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-sm outline-none focus:border-kondo-green dark:border-white/10"
                    maxLength={100}
                    minLength={3}
                    name="name"
                    required
                  />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-bold">Icon</span>
                  <input
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-center text-lg outline-none focus:border-kondo-green dark:border-white/10"
                    maxLength={8}
                    name="icon"
                    placeholder="✦"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">
                  Description
                </span>
                <textarea
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-transparent p-4 text-sm leading-6 outline-none focus:border-kondo-green dark:border-white/10"
                  maxLength={1000}
                  minLength={10}
                  name="description"
                  required
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-bold">Type</span>
                  <select
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
                    name="type"
                    onChange={(event) => setType(event.target.value)}
                    value={type}
                  >
                    <option value="TOPIC">Topic</option>
                    <option value="CITY">City</option>
                    <option value="COUNTRY">Country</option>
                    <option value="UNIVERSITY">University</option>
                  </select>
                </label>
                <label>
                  <span className="mb-2 block text-sm font-bold">
                    How people join
                  </span>
                  <select
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
                    defaultValue="OPEN"
                    name="joinPolicy"
                  >
                    <option value="OPEN">Open</option>
                    <option value="REQUEST">Request approval</option>
                    <option value="INVITE_ONLY">Invitation only</option>
                  </select>
                </label>
              </div>
              {type === "COUNTRY" ? (
                <ReferenceSelect
                  label="Country"
                  name="countryId"
                  options={countries}
                />
              ) : null}
              {type === "CITY" ? (
                <ReferenceSelect label="City" name="cityId" options={cities} />
              ) : null}
              {type === "UNIVERSITY" ? (
                <ReferenceSelect
                  label="University"
                  name="universityId"
                  options={universities}
                />
              ) : null}
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-300 p-4 text-sm dark:border-white/15">
                <ImagePlus className="h-5 w-5 text-kondo-green" />
                <span className="min-w-0 flex-1 truncate">
                  {cover?.name ?? "Optional cover image (JPG, PNG, WebP)"}
                </span>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) =>
                    setCover(event.target.files?.[0] ?? null)
                  }
                  type="file"
                />
              </label>
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input className="h-4 w-4" name="isPrivate" type="checkbox" />
                Keep this community private
              </label>
              {error ? (
                <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end">
                <Button disabled={loading} type="submit">
                  {loading ? "Creating…" : "Create for review"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ReferenceSelect({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: ReferenceOption[];
}) {
  const [selected, setSelected] = useState("");
  return (
    <div>
      <input name={name} required type="hidden" value={selected} />
      <SearchableSelect
        label={label}
        onSelect={setSelected}
        options={options}
        placeholder={`Choose ${label.toLowerCase()}`}
        searchPlaceholder={`Search ${label.toLowerCase()}s`}
        selected={selected}
      />
    </div>
  );
}
