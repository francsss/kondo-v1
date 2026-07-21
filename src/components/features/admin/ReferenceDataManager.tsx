"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ReferenceType } from "@/lib/reference-data";

type CountryRecord = {
  type: "country";
  id: string;
  code: string;
  name: string;
  emoji: string | null;
  isActive: boolean;
  verified: boolean;
  cityCount: number;
  universityCount: number;
  userCount: number;
};
type CityRecord = {
  type: "city";
  id: string;
  slug: string;
  name: string;
  province: string | null;
  countryId: string;
  countryCode: string;
  countryName: string;
  isActive: boolean;
  verified: boolean;
  universityCount: number;
  userCount: number;
  listingCount: number;
};
type UniversityRecord = {
  type: "university";
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  countryId: string;
  countryCode: string;
  countryName: string;
  cityId: string;
  cityName: string;
  isActive: boolean;
  verified: boolean;
  userCount: number;
  communityCount: number;
};
type ReferenceRecord = CountryRecord | CityRecord | UniversityRecord;
type ReferenceOptions = {
  countries: Array<{
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  }>;
  cities: Array<{
    id: string;
    name: string;
    countryId: string;
    countryCode: string;
    isActive: boolean;
  }>;
};

export function ReferenceDataManager({
  type,
  records,
  options,
  canManage,
}: {
  type: ReferenceType;
  records: ReferenceRecord[];
  options: ReferenceOptions;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ReferenceRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const payload =
      type === "countries"
        ? {
            code: String(values.get("code") ?? ""),
            name: String(values.get("name") ?? ""),
            emoji: String(values.get("emoji") ?? "") || null,
            isActive: values.get("isActive") === "on",
            verified: values.get("verified") === "on",
          }
        : type === "cities"
          ? {
              slug: String(values.get("slug") ?? ""),
              name: String(values.get("name") ?? ""),
              province: String(values.get("province") ?? "") || null,
              countryId: String(values.get("countryId") ?? ""),
              isActive: values.get("isActive") === "on",
              verified: values.get("verified") === "on",
            }
          : {
              slug: String(values.get("slug") ?? ""),
              name: String(values.get("name") ?? ""),
              shortName: String(values.get("shortName") ?? "") || null,
              cityId: String(values.get("cityId") ?? ""),
              isActive: values.get("isActive") === "on",
              verified: values.get("verified") === "on",
            };

    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/reference-data/${type}${editing ? `/${editing.id}` : ""}`,
        {
          method: editing ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Reference data could not be saved.");
        return;
      }
      form.reset();
      setEditing(null);
      router.refresh();
    } catch {
      setError("Reference data could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(record: ReferenceRecord) {
    if (
      !window.confirm(
        `Delete ${record.name}? Referenced records must be deactivated instead.`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/reference-data/${type}/${record.id}`,
        { method: "DELETE", credentials: "include" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Reference data could not be deleted.");
        return;
      }
      if (editing?.id === record.id) setEditing(null);
      router.refresh();
    } catch {
      setError("Reference data could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
      <Card>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
            {editing ? (
              <Pencil className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </span>
          <div>
            <h2 className="font-black text-kondo-ink dark:text-white">
              {editing ? `Edit ${editing.name}` : `Add ${singular(type)}`}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Every change is written to AuditLog.
            </p>
          </div>
        </div>

        {canManage ? (
          <form
            className="mt-6 space-y-4"
            key={editing?.id ?? `new-${type}`}
            onSubmit={submit}
          >
            {type === "countries" ? (
              <>
                <TextField
                  defaultValue={editing?.type === "country" ? editing.code : ""}
                  label="ISO code"
                  maxLength={2}
                  name="code"
                  required
                />
                <TextField
                  defaultValue={editing?.name ?? ""}
                  label="Country name"
                  name="name"
                  required
                />
                <TextField
                  defaultValue={
                    editing?.type === "country" ? (editing.emoji ?? "") : ""
                  }
                  label="Emoji"
                  name="emoji"
                />
              </>
            ) : null}
            {type === "cities" ? (
              <>
                <TextField
                  defaultValue={editing?.type === "city" ? editing.slug : ""}
                  label="Slug"
                  name="slug"
                  required
                />
                <TextField
                  defaultValue={editing?.name ?? ""}
                  label="City name"
                  name="name"
                  required
                />
                <TextField
                  defaultValue={
                    editing?.type === "city" ? (editing.province ?? "") : ""
                  }
                  label="Province"
                  name="province"
                />
                <SelectField
                  defaultValue={
                    editing?.type === "city"
                      ? editing.countryId
                      : (options.countries[0]?.id ?? "")
                  }
                  label="Country"
                  name="countryId"
                  options={options.countries.map((country) => ({
                    id: country.id,
                    label: `${country.code} · ${country.name}${country.isActive ? "" : " · inactive"}`,
                  }))}
                />
              </>
            ) : null}
            {type === "universities" ? (
              <>
                <TextField
                  defaultValue={
                    editing?.type === "university" ? editing.slug : ""
                  }
                  label="Slug"
                  name="slug"
                  required
                />
                <TextField
                  defaultValue={editing?.name ?? ""}
                  label="University name"
                  name="name"
                  required
                />
                <TextField
                  defaultValue={
                    editing?.type === "university"
                      ? (editing.shortName ?? "")
                      : ""
                  }
                  label="Short name"
                  name="shortName"
                />
                <SelectField
                  defaultValue={
                    editing?.type === "university"
                      ? editing.cityId
                      : (options.cities[0]?.id ?? "")
                  }
                  label="City"
                  name="cityId"
                  options={options.cities.map((city) => ({
                    id: city.id,
                    label: `${city.name} · ${city.countryCode}${city.isActive ? "" : " · inactive"}`,
                  }))}
                />
              </>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <CheckboxField
                defaultChecked={editing ? editing.isActive : true}
                label="Active"
                name="isActive"
              />
              <CheckboxField
                defaultChecked={editing?.verified ?? false}
                label="Verified"
                name="verified"
              />
            </div>
            {error ? (
              <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button disabled={saving} type="submit">
                {saving ? "Saving…" : editing ? "Save changes" : "Create"}
              </Button>
              {editing ? (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setError("");
                  }}
                  type="button"
                  variant="secondary"
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            Your role can view reference data but cannot change it.
          </p>
        )}
      </Card>

      <div className="space-y-3">
        {records.length ? (
          records.map((record) => (
            <Card key={record.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-kondo-ink dark:text-white">
                      {record.name}
                    </h3>
                    <StatusBadge active={record.isActive} />
                    <VerifiedBadge verified={record.verified} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {recordSummary(record)}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    {recordCounts(record)}
                  </p>
                </div>
                {canManage ? (
                  <div className="flex gap-2">
                    <Button
                      aria-label={`Edit ${record.name}`}
                      onClick={() => {
                        setEditing(record);
                        setError("");
                      }}
                      size="icon"
                      variant="secondary"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label={`Delete ${record.name}`}
                      disabled={saving}
                      onClick={() => remove(record)}
                      size="icon"
                      variant="danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>
          ))
        ) : (
          <Card className="py-14 text-center">
            <p className="font-black text-kondo-ink dark:text-white">
              No reference records match this view.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

function singular(type: ReferenceType) {
  if (type === "countries") return "country";
  if (type === "cities") return "city";
  return "university";
}

function recordSummary(record: ReferenceRecord) {
  if (record.type === "country") return record.code;
  if (record.type === "city") {
    return `${record.slug} · ${record.province ?? "No province"} · ${record.countryCode}`;
  }
  return `${record.slug} · ${record.shortName ?? "No short name"} · ${record.cityName}, ${record.countryCode}`;
}

function recordCounts(record: ReferenceRecord) {
  if (record.type === "country") {
    return `${record.cityCount} cities · ${record.universityCount} universities · ${record.userCount} origin profiles`;
  }
  if (record.type === "city") {
    return `${record.universityCount} universities · ${record.userCount} students · ${record.listingCount} listings`;
  }
  return `${record.userCount} students · ${record.communityCount} communities`;
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
      <CheckCircle2 className="h-3 w-3" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-muted-foreground dark:bg-white/5 dark:text-muted-foreground">
      <XCircle className="h-3 w-3" /> Inactive
    </span>
  );
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={
        verified
          ? "rounded-full bg-sky-50 px-2 py-1 text-[10px] font-black text-sky-700 dark:bg-sky-400/10 dark:text-sky-300"
          : "rounded-full bg-orange-50 px-2 py-1 text-[10px] font-black text-orange-700 dark:bg-orange-400/10 dark:text-orange-300"
      }
    >
      {verified ? "Verified" : "Unverified"}
    </span>
  );
}

function TextField({
  label,
  name,
  defaultValue,
  required,
  maxLength,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-kondo-ink dark:text-white">
        {label}
      </span>
      <input
        className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-sm outline-none focus:border-kondo-green dark:border-white/10"
        defaultValue={defaultValue}
        maxLength={maxLength}
        name={name}
        required={required}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<{ id: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-kondo-ink dark:text-white">
        {label}
      </span>
      <select
        className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-sm dark:border-white/10"
        defaultValue={defaultValue}
        name={name}
        required
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 text-sm font-bold text-kondo-ink dark:border-white/10 dark:text-white">
      <input defaultChecked={defaultChecked} name={name} type="checkbox" />
      {label}
    </label>
  );
}
