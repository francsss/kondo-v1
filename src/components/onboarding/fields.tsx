"use client";

import { Check, Plus, Search, X } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export type ChoiceOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
  icon?: string;
};

/** Groups related questions so a single screen still reads as a short form. */
export function FieldSection({
  title,
  hint,
  children,
  className,
}: {
  title?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-4", className)}>
      {title ? (
        <div>
          <h2 className="text-sm font-black tracking-tight text-kondo-ink dark:text-white">
            {title}
          </h2>
          {hint ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {hint}
            </p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

/**
 * Hints are described, never labelled: keeping them out of the `<label>` means
 * the accessible name stays exactly the question that was asked.
 */
function FieldLabel({
  label,
  hint,
  htmlFor,
  hintId,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  hintId: string;
}) {
  return (
    <>
      <label
        className="mb-1.5 block text-sm font-bold text-kondo-ink dark:text-white"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      {hint ? (
        <p className="mb-2 text-xs leading-5 text-muted-foreground" id={hintId}>
          {hint}
        </p>
      ) : null}
    </>
  );
}

const fieldClass =
  "kondo-field h-12 w-full rounded-2xl border border-border bg-background px-4 text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-sm";

export function TextField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  inputMode,
  maxLength,
  autoComplete,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <FieldLabel
        hint={hint}
        hintId={`${id}-hint`}
        htmlFor={id}
        label={label}
      />
      <input
        aria-describedby={hint ? `${id}-hint` : undefined}
        autoComplete={autoComplete}
        className={fieldClass}
        id={id}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </div>
  );
}

export function DateField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <FieldLabel
        hint={hint}
        hintId={`${id}-hint`}
        htmlFor={id}
        label={label}
      />
      <input
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={fieldClass}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <FieldLabel
        hint={hint}
        hintId={`${id}-hint`}
        htmlFor={id}
        label={label}
      />
      <textarea
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="kondo-field min-h-28 w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
        id={id}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      {maxLength ? (
        <span className="mt-1 block text-right text-[11px] tabular-nums text-muted-foreground">
          {value.length}/{maxLength}
        </span>
      ) : null}
    </div>
  );
}

/** Compact single-select used instead of a native dropdown on mobile. */
export function ChoiceChips<T extends string>({
  label,
  hint,
  options,
  selected,
  onSelect,
}: {
  label?: string;
  hint?: string;
  options: readonly ChoiceOption<T>[];
  selected: T | "";
  onSelect: (value: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      {label ? (
        <legend className="mb-1.5 text-sm font-bold text-kondo-ink dark:text-white">
          {label}
        </legend>
      ) : null}
      {hint ? (
        <p className="mb-2 text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected === option.value;
          return (
            <button
              aria-pressed={active}
              className={cn(
                "rounded-full border px-4 py-2.5 text-sm font-bold outline-none transition motion-reduce:transition-none",
                "focus-visible:ring-4 focus-visible:ring-kondo-green/20",
                active
                  ? "border-kondo-green bg-kondo-green text-white shadow-sm"
                  : "border-border bg-background text-muted-foreground hover:border-kondo-green/50 hover:text-foreground",
              )}
              key={option.value}
              onClick={() => onSelect(option.value)}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Expressive single-select for decisions that define the rest of the flow. */
export function ChoiceCards<T extends string>({
  label,
  hint,
  options,
  selected,
  onSelect,
  columns = 1,
}: {
  label?: string;
  hint?: string;
  options: readonly ChoiceOption<T>[];
  selected: T | "";
  onSelect: (value: T) => void;
  columns?: 1 | 2;
}) {
  return (
    <fieldset className="min-w-0">
      {label ? (
        <legend className="mb-1.5 text-sm font-bold text-kondo-ink dark:text-white">
          {label}
        </legend>
      ) : null}
      {hint ? (
        <p className="mb-2 text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
      <div className={cn("grid gap-2.5", columns === 2 && "sm:grid-cols-2")}>
        {options.map((option) => {
          const active = selected === option.value;
          return (
            <button
              aria-pressed={active}
              className={cn(
                "flex items-center gap-3.5 rounded-3xl border p-3.5 text-left outline-none transition motion-reduce:transition-none",
                "focus-visible:ring-4 focus-visible:ring-kondo-green/20",
                active
                  ? "border-kondo-green bg-kondo-mint text-kondo-forest shadow-sm dark:bg-emerald-400/10 dark:text-emerald-200"
                  : "border-border bg-background hover:border-kondo-green/50 hover:bg-muted/60",
              )}
              key={option.value}
              onClick={() => onSelect(option.value)}
              type="button"
            >
              {option.icon ? (
                <span
                  aria-hidden="true"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-card text-2xl shadow-sm"
                >
                  {option.icon}
                </span>
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black">{option.label}</span>
                {option.description ? (
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    {option.description}
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition",
                  active
                    ? "border-kondo-green bg-kondo-green text-white"
                    : "border-border",
                )}
              >
                {active ? <Check className="h-3 w-3" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Multi-select over reference data, searchable and summarised by chips. */
export function MultiSelectField({
  label,
  hint,
  options,
  selected,
  onChange,
  searchPlaceholder,
  emptyMessage = "No match found.",
}: {
  label: string;
  hint?: string;
  options: { id: string; name: string; secondary?: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase();
  const filtered = normalized
    ? options.filter((option) =>
        `${option.name} ${option.secondary ?? ""}`
          .toLocaleLowerCase()
          .includes(normalized),
      )
    : options;
  const selectedOptions = selected
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is (typeof options)[number] => Boolean(option));

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
    );
  }

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-bold text-kondo-ink dark:text-white">
        {label}
      </legend>
      {hint ? (
        <p className="mb-2 text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
      {selectedOptions.length ? (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {selectedOptions.map((option) => (
            <button
              className="inline-flex items-center gap-1.5 rounded-full bg-kondo-mint px-3 py-1.5 text-xs font-bold text-kondo-forest transition hover:bg-kondo-mint/70 dark:bg-emerald-400/10 dark:text-emerald-200"
              key={option.id}
              onClick={() => toggle(option.id)}
              type="button"
            >
              {option.name}
              <X aria-hidden="true" className="h-3 w-3" />
              <span className="sr-only">Remove {option.name}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        <div className="kondo-field flex h-12 items-center gap-2 border-b border-border px-3.5">
          <Search aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          <input
            aria-label={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
            className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}…`}
            value={query}
          />
        </div>
        <div className="max-h-56 overflow-y-auto overscroll-contain p-1.5">
          {filtered.length ? (
            filtered.map((option) => {
              const checked = selected.includes(option.id);
              return (
                <button
                  aria-pressed={checked}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                    checked
                      ? "bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
                      : "text-foreground hover:bg-muted",
                  )}
                  key={option.id}
                  onClick={() => toggle(option.id)}
                  type="button"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {option.name}
                    </span>
                    {option.secondary ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.secondary}
                      </span>
                    ) : null}
                  </span>
                  {checked ? <Check className="h-4 w-4 shrink-0" /> : null}
                </button>
              );
            })
          ) : (
            <p className="px-3 py-7 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          )}
        </div>
      </div>
    </fieldset>
  );
}

/** Multi-select over a fixed list, rendered as toggleable pills. */
export function TogglePills({
  label,
  hint,
  options,
  selected,
  onChange,
}: {
  label?: string;
  hint?: string;
  options: readonly { value: string; label: string; icon?: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset className="min-w-0">
      {label ? (
        <legend className="mb-1.5 text-sm font-bold text-kondo-ink dark:text-white">
          {label}
        </legend>
      ) : null}
      {hint ? (
        <p className="mb-2 text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold outline-none transition motion-reduce:transition-none",
                "focus-visible:ring-4 focus-visible:ring-kondo-green/20",
                active
                  ? "border-kondo-green bg-kondo-mint text-kondo-forest shadow-sm dark:bg-emerald-400/10 dark:text-emerald-200"
                  : "border-border bg-background text-muted-foreground hover:border-kondo-green/50 hover:text-foreground",
              )}
              key={option.value}
              onClick={() =>
                onChange(
                  active
                    ? selected.filter((item) => item !== option.value)
                    : [...selected, option.value],
                )
              }
              type="button"
            >
              {option.icon ? (
                <span aria-hidden="true">{option.icon}</span>
              ) : null}
              {option.label}
              {active ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Free-form tag entry with suggestions, replacing comma-separated text input
 * which is hard to correct on a phone.
 */
export function TokenField({
  label,
  hint,
  values,
  onChange,
  suggestions = [],
  placeholder,
  max = 8,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: readonly string[];
  placeholder?: string;
  max?: number;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const remainingSuggestions = suggestions.filter(
    (suggestion) =>
      !values.some(
        (value) => value.toLocaleLowerCase() === suggestion.toLocaleLowerCase(),
      ),
  );

  function add(raw: string) {
    const value = raw.trim();
    if (!value || values.length >= max) return;
    if (
      values.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())
    ) {
      setDraft("");
      return;
    }
    onChange([...values, value.slice(0, 40)]);
    setDraft("");
  }

  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-sm font-bold text-kondo-ink dark:text-white" htmlFor={id}>
        {label}
      </label>
      {hint ? (
        <p className="mb-2 text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
      {values.length ? (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <button
              className="inline-flex items-center gap-1.5 rounded-full bg-kondo-mint px-3 py-1.5 text-xs font-bold text-kondo-forest transition hover:bg-kondo-mint/70 dark:bg-emerald-400/10 dark:text-emerald-200"
              key={value}
              onClick={() => onChange(values.filter((item) => item !== value))}
              type="button"
            >
              {value}
              <X aria-hidden="true" className="h-3 w-3" />
              <span className="sr-only">Remove {value}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="kondo-field flex h-12 items-center gap-2 rounded-2xl border border-border bg-background px-4">
        <input
          className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
          disabled={values.length >= max}
          id={id}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add(draft);
            }
            if (event.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          placeholder={values.length >= max ? `Maximum ${max}` : placeholder}
          value={draft}
        />
        {draft.trim() ? (
          <button
            aria-label={`Add ${draft.trim()}`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-kondo-green text-white"
            onClick={() => add(draft)}
            type="button"
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {remainingSuggestions.length && values.length < max ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {remainingSuggestions.slice(0, 6).map((suggestion) => (
            <button
              className="rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-kondo-green/60 hover:text-foreground"
              key={suggestion}
              onClick={() => add(suggestion)}
              type="button"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
