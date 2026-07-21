"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  SaveButtonLabel,
  SaveFeedback,
  type SaveState,
} from "@/components/forms/SaveFeedback";
import { UnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type {
  ExploreAccent,
  ExploreEntry,
  ExploreEntryType,
  ExploreIconName,
  ExploreSection,
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

type SectionDetails = Omit<ExploreSection, "entries">;
type Status = "DRAFT" | "REVIEW" | "PUBLISHED";

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

function mutableEntry(entry: ExploreEntry): EditableEntry {
  return {
    ...entry,
    tags: [...entry.tags],
    details: [...entry.details],
  };
}

function initialEntry(type: ExploreEntryType): EditableEntry {
  return {
    id: "",
    slug: "",
    type,
    title: "",
    category: "",
    summary: "",
    location: "",
    status: "",
    tags: [],
    details: [],
  };
}

function defaultEntryType(icon: ExploreIconName): ExploreEntryType {
  const mapping: Record<ExploreIconName, ExploreEntryType> = {
    companies: "company",
    products: "product",
    universities: "university",
    jobs: "opportunity",
    events: "event",
    services: "service",
    about: "story",
  };
  return mapping[icon];
}

function valuesMatch(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requestError(error: unknown, fallback: string) {
  if (error instanceof TypeError) {
    return `${fallback} Check your connection and try again. Your changes are still here.`;
  }
  return error instanceof Error ? error.message : fallback;
}

export function CityHubSectionEditor({
  hubId,
  status,
  version,
  section,
}: {
  hubId: string;
  status: Status;
  version: number;
  section: ExploreSection;
}) {
  const router = useRouter();
  const details: SectionDetails = {
    slug: section.slug,
    title: section.title,
    shortTitle: section.shortTitle,
    eyebrow: section.eyebrow,
    summary: section.summary,
    description: section.description,
    icon: section.icon,
    accent: section.accent,
    signal: section.signal,
    studentValue: section.studentValue,
    cityValue: section.cityValue,
  };
  const [value, setValue] = useState(details);
  const [savedValue, setSavedValue] = useState(details);
  const [currentVersion, setCurrentVersion] = useState(version);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [dirtyEditors, setDirtyEditors] = useState<Set<string>>(new Set());
  const editable = status === "DRAFT";
  const sectionDirty = !valuesMatch(value, savedValue);
  const isDirty = sectionDirty || dirtyEditors.size > 0;
  const displayedSaveState: SaveState =
    sectionDirty && saveState === "success" ? "idle" : saveState;

  const reportEditorDirty = useCallback((editorId: string, dirty: boolean) => {
    setDirtyEditors((current) => {
      const next = new Set(current);
      if (dirty) next.add(editorId);
      else next.delete(editorId);
      return next;
    });
  }, []);

  const updateVersion = useCallback((nextVersion: number) => {
    setCurrentVersion(nextVersion);
  }, []);

  async function saveSection() {
    setSaveState("saving");
    setMessage("");
    try {
      const response = await fetch(
        `/api/admin/city-hubs/${hubId}/sections/${section.slug}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload: value,
            expectedVersion: currentVersion,
          }),
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Could not save this section.");
      }
      setCurrentVersion(data.hub.version);
      setSavedValue(structuredClone(value));
      setSaveState("success");
      setMessage("Section settings saved. Other sections were not changed.");
      router.refresh();
    } catch (error) {
      setSaveState("error");
      setMessage(
        requestError(
          error,
          "Could not save this section. Your changes are still here.",
        ),
      );
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {!editable ? (
        <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-400/20 dark:bg-amber-400/5">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
            This hub is in {status}. Send it back to draft before editing this
            section or its entries.
          </p>
        </Card>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-kondo-ink dark:text-white">
              {section.title} settings
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              This form only updates the current section. Its entries are saved
              separately below.
            </p>
          </div>
          <Button
            disabled={
              !editable || displayedSaveState === "saving" || !sectionDirty
            }
            onClick={saveSection}
            type="button"
          >
            {displayedSaveState === "idle" || displayedSaveState === "error" ? (
              <Save className="h-4 w-4" />
            ) : null}
            <SaveButtonLabel
              idleLabel="Save section"
              state={displayedSaveState}
            />
          </Button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field
            disabled={!editable}
            label="Title"
            value={value.title}
            onChange={(title) => setValue({ ...value, title })}
          />
          <Field
            disabled={!editable}
            label="Short title"
            value={value.shortTitle}
            onChange={(shortTitle) => setValue({ ...value, shortTitle })}
          />
          <Field disabled label="Slug" value={value.slug} />
          <Field
            disabled={!editable}
            label="Eyebrow"
            value={value.eyebrow}
            onChange={(eyebrow) => setValue({ ...value, eyebrow })}
          />
          <SelectField
            disabled={!editable}
            label="Icon"
            options={icons}
            value={value.icon}
            onChange={(icon) =>
              setValue({ ...value, icon: icon as ExploreIconName })
            }
          />
          <SelectField
            disabled={!editable}
            label="Accent"
            options={accents}
            value={value.accent}
            onChange={(accent) =>
              setValue({ ...value, accent: accent as ExploreAccent })
            }
          />
          <div className="sm:col-span-2">
            <Field
              disabled={!editable}
              label="Summary"
              multiline
              value={value.summary}
              onChange={(summary) => setValue({ ...value, summary })}
            />
          </div>
          <div className="sm:col-span-2">
            <Field
              disabled={!editable}
              label="Description"
              multiline
              value={value.description}
              onChange={(description) => setValue({ ...value, description })}
            />
          </div>
          <Field
            disabled={!editable}
            label="Local signal"
            value={value.signal}
            onChange={(signal) => setValue({ ...value, signal })}
          />
          <Field
            disabled={!editable}
            label="Student value"
            multiline
            value={value.studentValue}
            onChange={(studentValue) => setValue({ ...value, studentValue })}
          />
          <div className="sm:col-span-2">
            <Field
              disabled={!editable}
              label="City value"
              multiline
              value={value.cityValue}
              onChange={(cityValue) => setValue({ ...value, cityValue })}
            />
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-kondo-ink dark:text-white">
            {section.shortTitle} entries
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {section.entries.length} entries. Every entry has its own save and
            delete operation.
          </p>
        </div>
      </div>

      {editable && section.entries.length < 50 ? (
        <details className="rounded-3xl border border-dashed border-kondo-green/40 bg-emerald-50/40 p-5 dark:bg-emerald-400/5">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-black text-kondo-green">
            <Plus className="h-4 w-4" /> Add a {section.shortTitle} entry
          </summary>
          <div className="mt-5">
            <EntryEditor
              create
              defaultType={defaultEntryType(section.icon)}
              hubId={hubId}
              onDirtyChange={reportEditorDirty}
              onVersionChange={updateVersion}
              sectionSlug={section.slug}
              status={status}
              version={currentVersion}
            />
          </div>
        </details>
      ) : null}

      <div className="space-y-4">
        {section.entries.map((entry) => (
          <Card key={entry.id}>
            <EntryEditor
              entry={entry}
              hubId={hubId}
              onDirtyChange={reportEditorDirty}
              onVersionChange={updateVersion}
              sectionSlug={section.slug}
              status={status}
              version={currentVersion}
            />
          </Card>
        ))}
        {!section.entries.length ? (
          <Card className="py-14 text-center text-sm text-muted-foreground">
            No entries in this section yet. You can create one without editing
            any other City Hub section.
          </Card>
        ) : null}
      </div>
      <SaveFeedback message={message} state={displayedSaveState} />
      <UnsavedChangesGuard isDirty={isDirty} />
    </div>
  );
}

function EntryEditor({
  hubId,
  sectionSlug,
  version,
  status,
  entry,
  defaultType = "story",
  create = false,
  onDirtyChange,
  onVersionChange,
}: {
  hubId: string;
  sectionSlug: string;
  version: number;
  status: Status;
  entry?: ExploreEntry;
  defaultType?: ExploreEntryType;
  create?: boolean;
  onDirtyChange: (editorId: string, dirty: boolean) => void;
  onVersionChange: (version: number) => void;
}) {
  const router = useRouter();
  const initialValue = () =>
    entry ? mutableEntry(entry) : initialEntry(defaultType);
  const [value, setValue] = useState<EditableEntry>(initialValue);
  const [savedValue, setSavedValue] = useState<EditableEntry>(initialValue);
  const [createEntryId, setCreateEntryId] = useState(() =>
    create ? crypto.randomUUID() : "",
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const editable = status === "DRAFT";
  const editorId = create ? `new-${sectionSlug}` : entry!.id;
  const isDirty = !valuesMatch(value, savedValue);

  useEffect(() => {
    onDirtyChange(editorId, isDirty);
  }, [editorId, isDirty, onDirtyChange]);

  useEffect(
    () => () => onDirtyChange(editorId, false),
    [editorId, onDirtyChange],
  );

  const displayedSaveState: SaveState =
    isDirty && saveState === "success" ? "idle" : saveState;

  function payload(): EditableEntry {
    const sourceLabel = value.source?.label.trim() ?? "";
    const sourceHref = value.source?.href.trim() ?? "";
    return {
      ...value,
      id: create ? createEntryId : value.id,
      location: value.location?.trim() || undefined,
      status: value.status?.trim() || undefined,
      source:
        sourceLabel && sourceHref
          ? { label: sourceLabel, href: sourceHref }
          : undefined,
    };
  }

  async function save() {
    setSaveState("saving");
    setMessage("");
    const endpoint = create
      ? `/api/admin/city-hubs/${hubId}/sections/${sectionSlug}/entries`
      : `/api/admin/city-hubs/${hubId}/sections/${sectionSlug}/entries/${entry!.id}`;
    const submittedValue = payload();
    try {
      const response = await fetch(endpoint, {
        method: create ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: submittedValue,
          expectedVersion: version,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Could not save this entry.");
      }
      onVersionChange(data.hub.version);
      setSaveState("success");
      setMessage(
        create
          ? "Entry created and saved to the City Hub draft."
          : "Entry changes saved to the City Hub draft.",
      );
      if (create) {
        const resetValue = initialEntry(defaultType);
        setValue(resetValue);
        setSavedValue(resetValue);
        setCreateEntryId(crypto.randomUUID());
      } else {
        setValue(structuredClone(submittedValue));
        setSavedValue(structuredClone(submittedValue));
      }
      router.refresh();
    } catch (error) {
      setSaveState("error");
      setMessage(
        requestError(
          error,
          "Could not save this entry. Your changes are still here.",
        ),
      );
    }
  }

  async function remove() {
    if (!entry || !window.confirm(`Delete ${entry.title}?`)) return;
    setSaveState("saving");
    setMessage("");
    try {
      const response = await fetch(
        `/api/admin/city-hubs/${hubId}/sections/${sectionSlug}/entries/${entry.id}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedVersion: version }),
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Could not delete this entry.");
      }
      onDirtyChange(editorId, false);
      onVersionChange(data.hub.version);
      setSaveState("success");
      setMessage("Entry deleted from the City Hub draft.");
      router.refresh();
    } catch (error) {
      setSaveState("error");
      setMessage(requestError(error, "Could not delete this entry."));
    }
  }

  return (
    <div data-entry-title={create ? "New entry" : entry?.title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-kondo-ink dark:text-white">
            {create ? "New entry" : entry?.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {entryGuidance[value.type]}
          </p>
        </div>
        <div className="flex gap-2">
          {!create ? (
            <Button
              aria-label={`Delete ${entry?.title}`}
              disabled={!editable || displayedSaveState === "saving"}
              onClick={remove}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            disabled={!editable || displayedSaveState === "saving" || !isDirty}
            onClick={save}
            type="button"
          >
            {displayedSaveState === "idle" || displayedSaveState === "error" ? (
              <Save className="h-4 w-4" />
            ) : null}
            <SaveButtonLabel
              idleLabel={create ? "Create entry" : "Save entry"}
              state={displayedSaveState}
              successLabel={create ? "Created" : "Saved"}
            />
          </Button>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <SelectField
          disabled={!editable}
          label="Content type"
          options={entryTypes}
          value={value.type}
          onChange={(type) =>
            setValue({ ...value, type: type as ExploreEntryType })
          }
        />
        <Field
          disabled={!editable}
          label="Title / name"
          value={value.title}
          onChange={(title) => setValue({ ...value, title })}
        />
        <Field
          disabled={!editable}
          label="Slug"
          value={value.slug}
          onChange={(slug) => setValue({ ...value, slug })}
        />
        <Field
          disabled={!editable}
          label="Category"
          value={value.category}
          onChange={(category) => setValue({ ...value, category })}
        />
        <Field
          disabled={!editable}
          label="Location / address"
          value={value.location ?? ""}
          onChange={(location) => setValue({ ...value, location })}
        />
        <Field
          disabled={!editable}
          label="Status / date / deadline"
          value={value.status ?? ""}
          onChange={(entryStatus) =>
            setValue({ ...value, status: entryStatus })
          }
        />
        <div className="sm:col-span-2">
          <Field
            disabled={!editable}
            label="Summary / description"
            multiline
            value={value.summary}
            onChange={(summary) => setValue({ ...value, summary })}
          />
        </div>
        <div className="sm:col-span-2">
          <Field
            disabled={!editable}
            label="Tags (comma separated)"
            value={value.tags.join(", ")}
            onChange={(tags) =>
              setValue({
                ...value,
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
            disabled={!editable}
            label="Structured details (one item per line)"
            multiline
            value={value.details.join("\n")}
            onChange={(details) =>
              setValue({
                ...value,
                details: details
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
        <Field
          disabled={!editable}
          label="Source label"
          value={value.source?.label ?? ""}
          onChange={(label) =>
            setValue({
              ...value,
              source: { label, href: value.source?.href ?? "" },
            })
          }
        />
        <Field
          disabled={!editable}
          label="Source URL"
          value={value.source?.href ?? ""}
          onChange={(href) =>
            setValue({
              ...value,
              source: { label: value.source?.label ?? "", href },
            })
          }
        />
      </div>
      <SaveFeedback message={message} state={displayedSaveState} />
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
    <label className="block text-xs font-bold text-muted-foreground">
      {label}
      {multiline ? (
        <textarea
          className={`${inputClass} min-h-24 resize-y`}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
        />
      ) : (
        <input
          className={inputClass}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
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
    <label className="block text-xs font-bold text-muted-foreground">
      {label}
      <select
        className={inputClass}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
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
