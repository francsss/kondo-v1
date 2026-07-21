"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { uploadPublicImage } from "@/lib/client-media";

type Option = { id: string; name: string };

export function OfficialCommunityCreateForm({
  countries,
  cities,
  universities,
}: {
  countries: Option[];
  cities: Option[];
  universities: Option[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState("TOPIC");
  const [cover, setCover] = useState<File | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      setPending(true);
      setMessage("");
      const name = String(values.get("name") ?? "");
      const coverMediaId = cover
        ? await uploadPublicImage(
            cover,
            "COMMUNITY_COVER",
            `${name} community cover`,
          )
        : null;
      const response = await fetch("/api/admin/communities", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: values.get("description"),
          type,
          icon: String(values.get("icon") ?? "").trim() || null,
          isPrivate: values.has("isPrivate"),
          joinPolicy: values.get("joinPolicy"),
          countryId:
            type === "COUNTRY" ? values.get("countryId") || null : null,
          cityId: type === "CITY" ? values.get("cityId") || null : null,
          universityId:
            type === "UNIVERSITY" ? values.get("universityId") || null : null,
          coverMediaId,
        }),
      }).catch(() => null);
      const payload = await response?.json().catch(() => null);
      if (!response?.ok) {
        throw new Error(
          payload?.error ?? "Could not create the official community.",
        );
      }
      form.reset();
      setType("TOPIC");
      setCover(null);
      setMessage("Official community created and activated.");
      router.refresh();
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : "Could not create the official community.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mt-6">
      <h2 className="font-black text-kondo-ink dark:text-white">
        Create official community
      </h2>
      <p className="mt-2 text-xs text-muted-foreground">
        Official communities are created active and verified. They remain
        explicitly distinct from user-created communities.
      </p>
      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <input
          className="h-11 rounded-2xl border border-slate-200 bg-transparent px-4 text-sm dark:border-white/10"
          maxLength={100}
          minLength={3}
          name="name"
          placeholder="Community name"
          required
        />
        <input
          className="h-11 rounded-2xl border border-slate-200 bg-transparent px-4 text-sm dark:border-white/10"
          maxLength={12}
          name="icon"
          placeholder="Icon or emoji (optional)"
        />
        <select
          className="h-11 rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
          onChange={(event) => setType(event.target.value)}
          value={type}
        >
          <option value="TOPIC">Topic</option>
          <option value="CITY">City</option>
          <option value="COUNTRY">Country</option>
          <option value="UNIVERSITY">University</option>
        </select>
        <select
          className="h-11 rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
          defaultValue="OPEN"
          name="joinPolicy"
        >
          <option value="OPEN">Open</option>
          <option value="REQUEST">Request approval</option>
          <option value="INVITE_ONLY">Invite only</option>
        </select>
        {type === "COUNTRY" ? (
          <OptionSelect label="Country" name="countryId" options={countries} />
        ) : null}
        {type === "CITY" ? (
          <OptionSelect label="City" name="cityId" options={cities} />
        ) : null}
        {type === "UNIVERSITY" ? (
          <OptionSelect
            label="University"
            name="universityId"
            options={universities}
          />
        ) : null}
        <textarea
          className="min-h-24 rounded-2xl border border-slate-200 bg-transparent p-4 text-sm dark:border-white/10 sm:col-span-2"
          maxLength={500}
          minLength={10}
          name="description"
          placeholder="Community description"
          required
        />
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-300 p-4 text-sm dark:border-white/15 sm:col-span-2">
          <ImagePlus className="h-5 w-5 text-kondo-green" />
          <span className="min-w-0 flex-1 truncate">
            {cover?.name ?? "Add an optional R2-backed cover image"}
          </span>
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => setCover(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input name="isPrivate" type="checkbox" /> Private community
        </label>
        <div className="flex justify-end">
          <Button disabled={pending} type="submit">
            <Plus className="h-4 w-4" />
            {pending ? "Creating…" : "Create official community"}
          </Button>
        </div>
      </form>
      {message ? (
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </Card>
  );
}

function OptionSelect({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: Option[];
}) {
  return (
    <label className="text-xs font-bold text-muted-foreground">
      {label}
      <select
        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
        name={name}
        required
      >
        <option value="">Choose {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
