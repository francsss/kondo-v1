"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ExploreCity } from "@/features/explore/types";

type Details = Omit<ExploreCity, "sections">;

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-kondo-green disabled:opacity-60 dark:border-white/10";

export function CityHubDetailsEditor({
  hubId,
  status,
  version,
  details,
}: {
  hubId: string;
  status: "DRAFT" | "REVIEW" | "PUBLISHED";
  version: number;
  details: Details;
}) {
  const router = useRouter();
  const [value, setValue] = useState(details);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const editable = status === "DRAFT";

  async function save() {
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/admin/city-hubs/${hubId}/details`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: value, expectedVersion: version }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setPending(false);
    if (!response?.ok) {
      setMessage(data?.error ?? "Could not save the hub details.");
      return;
    }
    setMessage("Hub details saved.");
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-6">
      {!editable ? <ReadOnlyNotice status={status} /> : null}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-kondo-ink dark:text-white">
              City identity
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Saved independently from every content section.
            </p>
          </div>
          <Button disabled={!editable || pending} onClick={save} type="button">
            <Save className="h-4 w-4" /> {pending ? "Saving…" : "Save details"}
          </Button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field
            disabled={!editable}
            label="City name"
            value={value.name}
            onChange={(name) => setValue({ ...value, name })}
          />
          <Field disabled label="Slug" value={value.slug} />
          <Field
            disabled={!editable}
            label="Province"
            value={value.province}
            onChange={(province) => setValue({ ...value, province })}
          />
          <Field
            disabled={!editable}
            label="Country"
            value={value.country}
            onChange={(country) => setValue({ ...value, country })}
          />
          <Field
            disabled={!editable}
            label="Eyebrow"
            value={value.eyebrow}
            onChange={(eyebrow) => setValue({ ...value, eyebrow })}
          />
          <Field
            disabled={!editable}
            label="Page title"
            value={value.title}
            onChange={(title) => setValue({ ...value, title })}
          />
          <div className="sm:col-span-2">
            <Field
              disabled={!editable}
              label="Tagline"
              value={value.tagline}
              onChange={(tagline) => setValue({ ...value, tagline })}
            />
          </div>
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
        </div>
      </Card>

      <Card>
        <h2 className="font-black text-kondo-ink dark:text-white">
          City signals
        </h2>
        <div className="mt-4 space-y-3">
          {value.signals.map((signal, index) => (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" key={index}>
              <Field
                disabled={!editable}
                label="Label"
                value={signal.label}
                onChange={(label) =>
                  setValue({
                    ...value,
                    signals: value.signals.map((item, position) =>
                      position === index ? { ...item, label } : item,
                    ),
                  })
                }
              />
              <Field
                disabled={!editable}
                label="Value"
                value={signal.value}
                onChange={(signalValue) =>
                  setValue({
                    ...value,
                    signals: value.signals.map((item, position) =>
                      position === index
                        ? { ...item, value: signalValue }
                        : item,
                    ),
                  })
                }
              />
              <Button
                className="self-end"
                disabled={!editable}
                onClick={() =>
                  setValue({
                    ...value,
                    signals: value.signals.filter(
                      (_, position) => position !== index,
                    ),
                  })
                }
                type="button"
                variant="ghost"
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            disabled={!editable || value.signals.length >= 12}
            onClick={() =>
              setValue({
                ...value,
                signals: [...value.signals, { label: "", value: "" }],
              })
            }
            size="sm"
            type="button"
            variant="secondary"
          >
            Add signal
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="font-black text-kondo-ink dark:text-white">
          Impact points
        </h2>
        <div className="mt-4 space-y-4">
          {value.impactPoints.map((point, index) => (
            <div
              className="rounded-2xl border border-slate-200 p-4 dark:border-white/10"
              key={index}
            >
              <Field
                disabled={!editable}
                label="Title"
                value={point.title}
                onChange={(title) =>
                  setValue({
                    ...value,
                    impactPoints: value.impactPoints.map((item, position) =>
                      position === index ? { ...item, title } : item,
                    ),
                  })
                }
              />
              <Field
                disabled={!editable}
                label="Description"
                multiline
                value={point.description}
                onChange={(description) =>
                  setValue({
                    ...value,
                    impactPoints: value.impactPoints.map((item, position) =>
                      position === index ? { ...item, description } : item,
                    ),
                  })
                }
              />
              <Button
                className="mt-3"
                disabled={!editable}
                onClick={() =>
                  setValue({
                    ...value,
                    impactPoints: value.impactPoints.filter(
                      (_, position) => position !== index,
                    ),
                  })
                }
                size="sm"
                type="button"
                variant="ghost"
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            disabled={!editable || value.impactPoints.length >= 12}
            onClick={() =>
              setValue({
                ...value,
                impactPoints: [
                  ...value.impactPoints,
                  { title: "", description: "" },
                ],
              })
            }
            size="sm"
            type="button"
            variant="secondary"
          >
            Add impact point
          </Button>
        </div>
      </Card>

      {message ? (
        <p
          className="text-sm font-semibold text-slate-600 dark:text-slate-300"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

function ReadOnlyNotice({ status }: { status: string }) {
  return (
    <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-400/20 dark:bg-amber-400/5">
      <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
        This hub is in {status}. Send it back to draft before editing.
      </p>
    </Card>
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
