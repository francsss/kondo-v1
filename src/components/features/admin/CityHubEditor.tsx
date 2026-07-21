"use client";

import { ChevronDown, ChevronUp, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type {
  ExploreAccent,
  ExploreEntryType,
  ExploreIconName,
} from "@/features/explore/types";

type EditableEntry = {
  id: string;
  slug: string;
  type: ExploreEntryType;
  title: string;
  category: string;
  summary: string;
  location?: string;
  status?: string;
  tags: string[];
  details: string[];
  source?: { label: string; href: string };
};

type EditableSection = {
  slug: string;
  title: string;
  shortTitle: string;
  eyebrow: string;
  summary: string;
  description: string;
  icon: ExploreIconName;
  accent: ExploreAccent;
  signal: string;
  studentValue: string;
  cityValue: string;
  entries: EditableEntry[];
};

type EditableCity = {
  slug: string;
  name: string;
  province: string;
  country: string;
  eyebrow: string;
  title: string;
  tagline: string;
  summary: string;
  description: string;
  signals: Array<{ label: string; value: string }>;
  impactPoints: Array<{ title: string; description: string }>;
  sections: EditableSection[];
};

const icons: ExploreIconName[] = [
  "companies",
  "products",
  "universities",
  "jobs",
  "events",
  "services",
  "about",
];
const accents: ExploreAccent[] = [
  "emerald",
  "amber",
  "blue",
  "violet",
  "rose",
  "cyan",
  "slate",
];
const entryTypes: ExploreEntryType[] = [
  "company",
  "product",
  "university",
  "opportunity",
  "event",
  "service",
  "story",
];

const entryGuidance: Record<ExploreEntryType, string> = {
  company:
    "Use category for the business sector, location for the address, details for contact/opening information, and source for the official website.",
  product:
    "Use category for the product family, location for where to buy it, details for producer/price/contact information, and source for the official purchase page.",
  university:
    "Use location for the campus address, details for programs, scholarships and international admissions, and source for the application page.",
  opportunity:
    "Use category for job or internship type, status for deadline/verification, location for workplace, details for requirements and salary, and source for applications.",
  event:
    "Use status for the event date or cancellation state, location for the venue, details for organizer/time/capacity, and source for registration.",
  service:
    "Use category for service type, location for the office, details for provider, documents, opening hours and instructions, and source for the official service page.",
  story:
    "Use details for editorial facts and source for a reliable external reference.",
};

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-kondo-green disabled:opacity-60 dark:border-white/10";

function cloneDraft(draft: unknown) {
  return JSON.parse(JSON.stringify(draft)) as EditableCity;
}

function newSection(index: number): EditableSection {
  return {
    slug: `section-${index + 1}`,
    title: "New section",
    shortTitle: "New",
    eyebrow: "City guide",
    summary: "Add a short summary for this section.",
    description: "Add a complete description for this city section.",
    icon: "about",
    accent: "emerald",
    signal: "Add a useful local signal",
    studentValue: "Explain how this section helps students.",
    cityValue: "Explain how this section connects students with the city.",
    entries: [],
  };
}

function newEntry(type: ExploreEntryType, index: number): EditableEntry {
  return {
    id: crypto.randomUUID(),
    slug: `${type}-${Date.now()}-${index + 1}`,
    type,
    title: `New ${type}`,
    category: "General",
    summary: `Add a verified summary for this ${type}.`,
    tags: [],
    details: [],
  };
}

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
  const [city, setCity] = useState(() => cloneDraft(draft));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const editable = status === "DRAFT";

  function updateSection(index: number, patch: Partial<EditableSection>) {
    setCity((current) => ({
      ...current,
      sections: current.sections.map((section, position) =>
        position === index ? { ...section, ...patch } : section,
      ),
    }));
  }

  function updateEntry(
    sectionIndex: number,
    entryIndex: number,
    patch: Partial<EditableEntry>,
  ) {
    const section = city.sections[sectionIndex];
    if (!section) return;
    updateSection(sectionIndex, {
      entries: section.entries.map((entry, position) =>
        position === entryIndex ? { ...entry, ...patch } : entry,
      ),
    });
  }

  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= city.sections.length) return;
    setCity((current) => {
      const sections = [...current.sections];
      [sections[index], sections[target]] = [
        sections[target]!,
        sections[index]!,
      ];
      return { ...current, sections };
    });
  }

  function moveEntry(sectionIndex: number, index: number, direction: -1 | 1) {
    const section = city.sections[sectionIndex];
    if (!section) return;
    const target = index + direction;
    if (target < 0 || target >= section.entries.length) return;
    const entries = [...section.entries];
    [entries[index], entries[target]] = [entries[target]!, entries[index]!];
    updateSection(sectionIndex, { entries });
  }

  async function save() {
    setError("");
    setSaved(false);
    setPending(true);
    const response = await fetch(`/api/admin/city-hubs/${hubId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: city, expectedVersion: version }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setPending(false);
    if (!response?.ok) {
      setError(data?.error ?? "Could not save the draft.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-6">
      {!editable ? (
        <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-400/20 dark:bg-amber-400/5">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
            This hub is in {status}. Send it back to draft before editing. The
            live snapshot remains unchanged until the next publication.
          </p>
        </Card>
      ) : null}

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-kondo-ink dark:text-white">
              City identity
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Structured, validated fields · version {version}
            </p>
          </div>
          <Button disabled={!editable || pending} onClick={save} type="button">
            <Save className="h-4 w-4" /> {pending ? "Saving…" : "Save draft"}
          </Button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field
            label="City name"
            value={city.name}
            disabled={!editable}
            onChange={(name) => setCity({ ...city, name })}
          />
          <Field label="Slug" value={city.slug} disabled />
          <Field
            label="Province"
            value={city.province}
            disabled={!editable}
            onChange={(province) => setCity({ ...city, province })}
          />
          <Field
            label="Country"
            value={city.country}
            disabled={!editable}
            onChange={(country) => setCity({ ...city, country })}
          />
          <Field
            label="Eyebrow"
            value={city.eyebrow}
            disabled={!editable}
            onChange={(eyebrow) => setCity({ ...city, eyebrow })}
          />
          <Field
            label="Page title"
            value={city.title}
            disabled={!editable}
            onChange={(title) => setCity({ ...city, title })}
          />
          <div className="sm:col-span-2">
            <Field
              label="Tagline"
              value={city.tagline}
              disabled={!editable}
              onChange={(tagline) => setCity({ ...city, tagline })}
            />
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Summary"
              value={city.summary}
              multiline
              disabled={!editable}
              onChange={(summary) => setCity({ ...city, summary })}
            />
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Description"
              value={city.description}
              multiline
              disabled={!editable}
              onChange={(description) => setCity({ ...city, description })}
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-black text-kondo-ink dark:text-white">
            City signals
          </h2>
          <Button
            disabled={!editable}
            onClick={() =>
              setCity({
                ...city,
                signals: [
                  ...city.signals,
                  { label: "New signal", value: "Value" },
                ],
              })
            }
            size="sm"
            type="button"
            variant="secondary"
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {city.signals.map((signal, index) => (
            <div
              className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
              key={`${index}-${signal.label}`}
            >
              <Field
                label="Label"
                value={signal.label}
                disabled={!editable}
                onChange={(label) =>
                  setCity({
                    ...city,
                    signals: city.signals.map((item, position) =>
                      position === index ? { ...item, label } : item,
                    ),
                  })
                }
              />
              <Field
                label="Value"
                value={signal.value}
                disabled={!editable}
                onChange={(value) =>
                  setCity({
                    ...city,
                    signals: city.signals.map((item, position) =>
                      position === index ? { ...item, value } : item,
                    ),
                  })
                }
              />
              <Button
                aria-label="Remove signal"
                className="self-end"
                disabled={!editable}
                onClick={() =>
                  setCity({
                    ...city,
                    signals: city.signals.filter(
                      (_, position) => position !== index,
                    ),
                  })
                }
                size="icon"
                type="button"
                variant="ghost"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-black text-kondo-ink dark:text-white">
            Impact points
          </h2>
          <Button
            disabled={!editable}
            onClick={() =>
              setCity({
                ...city,
                impactPoints: [
                  ...city.impactPoints,
                  {
                    title: "New impact point",
                    description: "Explain the impact.",
                  },
                ],
              })
            }
            size="sm"
            type="button"
            variant="secondary"
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <div className="mt-4 space-y-4">
          {city.impactPoints.map((point, index) => (
            <div
              className="rounded-2xl border border-slate-200 p-4 dark:border-white/10"
              key={`${index}-${point.title}`}
            >
              <div className="flex justify-end">
                <Button
                  aria-label="Remove impact point"
                  disabled={!editable}
                  onClick={() =>
                    setCity({
                      ...city,
                      impactPoints: city.impactPoints.filter(
                        (_, position) => position !== index,
                      ),
                    })
                  }
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Field
                label="Title"
                value={point.title}
                disabled={!editable}
                onChange={(title) =>
                  setCity({
                    ...city,
                    impactPoints: city.impactPoints.map((item, position) =>
                      position === index ? { ...item, title } : item,
                    ),
                  })
                }
              />
              <Field
                label="Description"
                value={point.description}
                multiline
                disabled={!editable}
                onChange={(description) =>
                  setCity({
                    ...city,
                    impactPoints: city.impactPoints.map((item, position) =>
                      position === index ? { ...item, description } : item,
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-kondo-ink dark:text-white">
            City modules
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Companies, products, universities, jobs, events, services, and
            future modules share this ordered structure.
          </p>
        </div>
        <Button
          disabled={!editable || city.sections.length >= 12}
          onClick={() =>
            setCity({
              ...city,
              sections: [...city.sections, newSection(city.sections.length)],
            })
          }
          type="button"
        >
          <Plus className="h-4 w-4" /> Add module
        </Button>
      </div>

      {city.sections.map((section, sectionIndex) => (
        <Card key={`${section.slug}-${sectionIndex}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-kondo-green">
                Module {sectionIndex + 1}
              </p>
              <h3 className="mt-1 text-lg font-black text-kondo-ink dark:text-white">
                {section.title}
              </h3>
            </div>
            <div className="flex gap-1">
              <Button
                aria-label="Move module up"
                disabled={!editable || sectionIndex === 0}
                onClick={() => moveSection(sectionIndex, -1)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                aria-label="Move module down"
                disabled={
                  !editable || sectionIndex === city.sections.length - 1
                }
                onClick={() => moveSection(sectionIndex, 1)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                aria-label="Delete module"
                disabled={!editable || city.sections.length === 1}
                onClick={() =>
                  window.confirm(`Delete ${section.title}?`) &&
                  setCity({
                    ...city,
                    sections: city.sections.filter(
                      (_, position) => position !== sectionIndex,
                    ),
                  })
                }
                size="icon"
                type="button"
                variant="ghost"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field
              label="Title"
              value={section.title}
              disabled={!editable}
              onChange={(title) => updateSection(sectionIndex, { title })}
            />
            <Field
              label="Short title"
              value={section.shortTitle}
              disabled={!editable}
              onChange={(shortTitle) =>
                updateSection(sectionIndex, { shortTitle })
              }
            />
            <Field
              label="Slug"
              value={section.slug}
              disabled={!editable}
              onChange={(slug) => updateSection(sectionIndex, { slug })}
            />
            <Field
              label="Eyebrow"
              value={section.eyebrow}
              disabled={!editable}
              onChange={(eyebrow) => updateSection(sectionIndex, { eyebrow })}
            />
            <SelectField
              label="Icon"
              value={section.icon}
              options={icons}
              disabled={!editable}
              onChange={(icon) =>
                updateSection(sectionIndex, { icon: icon as ExploreIconName })
              }
            />
            <SelectField
              label="Accent"
              value={section.accent}
              options={accents}
              disabled={!editable}
              onChange={(accent) =>
                updateSection(sectionIndex, { accent: accent as ExploreAccent })
              }
            />
            <div className="sm:col-span-2">
              <Field
                label="Summary"
                value={section.summary}
                multiline
                disabled={!editable}
                onChange={(summary) => updateSection(sectionIndex, { summary })}
              />
            </div>
            <div className="sm:col-span-2">
              <Field
                label="Description"
                value={section.description}
                multiline
                disabled={!editable}
                onChange={(description) =>
                  updateSection(sectionIndex, { description })
                }
              />
            </div>
            <Field
              label="Local signal"
              value={section.signal}
              disabled={!editable}
              onChange={(signal) => updateSection(sectionIndex, { signal })}
            />
            <Field
              label="Student value"
              value={section.studentValue}
              multiline
              disabled={!editable}
              onChange={(studentValue) =>
                updateSection(sectionIndex, { studentValue })
              }
            />
            <div className="sm:col-span-2">
              <Field
                label="City value"
                value={section.cityValue}
                multiline
                disabled={!editable}
                onChange={(cityValue) =>
                  updateSection(sectionIndex, { cityValue })
                }
              />
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5 dark:border-white/10">
            <div>
              <h4 className="font-black text-kondo-ink dark:text-white">
                Entries
              </h4>
              <p className="text-xs text-slate-400">
                {section.entries.length} of 50 entries
              </p>
            </div>
            <EntryAddButton
              disabled={!editable || section.entries.length >= 50}
              onAdd={(type) =>
                updateSection(sectionIndex, {
                  entries: [
                    ...section.entries,
                    newEntry(type, section.entries.length),
                  ],
                })
              }
            />
          </div>

          <div className="mt-4 space-y-4">
            {section.entries.map((entry, entryIndex) => (
              <details
                className="rounded-2xl border border-slate-200 p-4 dark:border-white/10"
                key={entry.id}
                open={entryIndex === 0 && section.entries.length === 1}
              >
                <summary className="cursor-pointer font-bold text-kondo-ink dark:text-white">
                  {entry.title}{" "}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {entry.type}
                  </span>
                </summary>
                <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500 dark:bg-white/5 dark:text-slate-300">
                  {entryGuidance[entry.type]}
                </p>
                <div className="mt-4 flex justify-end gap-1">
                  <Button
                    aria-label="Move entry up"
                    disabled={!editable || entryIndex === 0}
                    onClick={() => moveEntry(sectionIndex, entryIndex, -1)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    aria-label="Move entry down"
                    disabled={
                      !editable || entryIndex === section.entries.length - 1
                    }
                    onClick={() => moveEntry(sectionIndex, entryIndex, 1)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    aria-label="Delete entry"
                    disabled={!editable}
                    onClick={() =>
                      window.confirm(`Delete ${entry.title}?`) &&
                      updateSection(sectionIndex, {
                        entries: section.entries.filter(
                          (_, position) => position !== entryIndex,
                        ),
                      })
                    }
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2 grid gap-4 sm:grid-cols-2">
                  <SelectField
                    label="Content type"
                    value={entry.type}
                    options={entryTypes}
                    disabled={!editable}
                    onChange={(type) =>
                      updateEntry(sectionIndex, entryIndex, {
                        type: type as ExploreEntryType,
                      })
                    }
                  />
                  <Field
                    label="Title / name"
                    value={entry.title}
                    disabled={!editable}
                    onChange={(title) =>
                      updateEntry(sectionIndex, entryIndex, { title })
                    }
                  />
                  <Field
                    label="Slug"
                    value={entry.slug}
                    disabled={!editable}
                    onChange={(slug) =>
                      updateEntry(sectionIndex, entryIndex, { slug })
                    }
                  />
                  <Field
                    label="Category"
                    value={entry.category}
                    disabled={!editable}
                    onChange={(category) =>
                      updateEntry(sectionIndex, entryIndex, { category })
                    }
                  />
                  <Field
                    label="Location / address"
                    value={entry.location ?? ""}
                    disabled={!editable}
                    onChange={(location) =>
                      updateEntry(sectionIndex, entryIndex, { location })
                    }
                  />
                  <Field
                    label="Status / date / deadline"
                    value={entry.status ?? ""}
                    disabled={!editable}
                    onChange={(statusValue) =>
                      updateEntry(sectionIndex, entryIndex, {
                        status: statusValue,
                      })
                    }
                  />
                  <div className="sm:col-span-2">
                    <Field
                      label="Summary / description"
                      value={entry.summary}
                      multiline
                      disabled={!editable}
                      onChange={(summary) =>
                        updateEntry(sectionIndex, entryIndex, { summary })
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Field
                      label="Tags (comma separated)"
                      value={entry.tags.join(", ")}
                      disabled={!editable}
                      onChange={(tags) =>
                        updateEntry(sectionIndex, entryIndex, {
                          tags: tags
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Field
                      label="Structured details (one item per line)"
                      value={entry.details.join("\n")}
                      multiline
                      disabled={!editable}
                      onChange={(details) =>
                        updateEntry(sectionIndex, entryIndex, {
                          details: details
                            .split("\n")
                            .map((item) => item.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </div>
                  <Field
                    label="Source label"
                    value={entry.source?.label ?? ""}
                    disabled={!editable}
                    onChange={(label) =>
                      updateEntry(sectionIndex, entryIndex, {
                        source:
                          label || entry.source?.href
                            ? { label, href: entry.source?.href ?? "" }
                            : undefined,
                      })
                    }
                  />
                  <Field
                    label="Source URL"
                    value={entry.source?.href ?? ""}
                    disabled={!editable}
                    onChange={(href) =>
                      updateEntry(sectionIndex, entryIndex, {
                        source:
                          href || entry.source?.label
                            ? {
                                label: entry.source?.label ?? "Official source",
                                href,
                              }
                            : undefined,
                      })
                    }
                  />
                </div>
              </details>
            ))}
            {!section.entries.length ? (
              <p className="rounded-2xl bg-slate-50 py-8 text-center text-sm text-slate-400 dark:bg-white/5">
                No entries in this module yet.
              </p>
            ) : null}
          </div>
        </Card>
      ))}

      {error ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p
          className="text-sm font-semibold text-emerald-600 dark:text-emerald-300"
          role="status"
        >
          Draft saved. Refresh complete.
        </p>
      ) : null}
      <div className="sticky bottom-20 z-20 flex justify-end lg:bottom-5">
        <Button
          className="shadow-lg"
          disabled={!editable || pending}
          onClick={save}
          type="button"
        >
          <Save className="h-4 w-4" />{" "}
          {pending ? "Saving…" : "Save all changes"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  multiline?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
      {label}
      {multiline ? (
        <textarea
          className={`${inputClass} min-h-24`}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value)}
          value={value}
        />
      ) : (
        <input
          className={inputClass}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value)}
          value={value}
        />
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
      {label}
      <select
        className={inputClass}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function EntryAddButton({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (type: ExploreEntryType) => void;
}) {
  const [type, setType] = useState<ExploreEntryType>("company");
  return (
    <div className="flex gap-2">
      <select
        aria-label="New entry type"
        className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-white/10"
        disabled={disabled}
        onChange={(event) => setType(event.target.value as ExploreEntryType)}
        value={type}
      >
        {entryTypes.map((entryType) => (
          <option key={entryType} value={entryType}>
            {entryType}
          </option>
        ))}
      </select>
      <Button
        disabled={disabled}
        onClick={() => onAdd(type)}
        size="sm"
        type="button"
        variant="secondary"
      >
        <Plus className="h-4 w-4" /> Add entry
      </Button>
    </div>
  );
}
