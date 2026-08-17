"use client";

import { useId } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/**
 * The Kondo form primitives.
 *
 * The organization forms were written against a `.input` class that does not
 * exist — not in `globals.css`, not in the Tailwind config, nowhere. Every
 * field in Create Product, Create Service and their edit screens was therefore
 * a raw browser control wearing a class name that styled nothing. That, and not
 * taste, is why the forms looked a decade old.
 *
 * These are the replacement, and they are deliberately few: a field wrapper
 * that owns the label, hint and error, and the three controls that wrapper
 * holds. Everything shares one shell so a select cannot drift from an input
 * again.
 *
 * Geometry never changes. The border is 1px in every state and only its colour
 * moves; focus is drawn with an inset ring, which cannot occupy layout, so a
 * field cannot shift sideways or resize when focused, when typed into, or when
 * an error appears. `box-sizing` is already global. This is what keeps the
 * measured movement at 0px rather than merely small.
 */

/**
 * The one control shell. Exported so forms that build their own markup can
 * still wear the same field rather than inventing a fifth variation.
 */
export const KONDO_CONTROL_CLASS = [
  // One shell for every control: same height, same radius, same border.
  "w-full min-h-12 rounded-2xl border border-border bg-card px-4 text-base text-foreground",
  "transition-[border-color,box-shadow] duration-200",
  "placeholder:text-muted-foreground",
  // Focus is inset, so it is painted inside the existing box and adds nothing
  // to layout. No outline, no offset ring, no width change.
  "outline-none focus:border-kondo-green/55 focus:shadow-[inset_0_0_0_1px_rgb(var(--ring)/0.35)]",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "motion-reduce:transition-none",
].join(" ");

const CONTROL = KONDO_CONTROL_CLASS;

/** Errors recolour the border only — still 1px, still the same box. */
const INVALID = "border-destructive/70 focus:border-destructive";

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label: string;
  /** One short line. Not a paragraph of instructions. */
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn("block", className)}>
      <label
        className="block text-sm font-black text-foreground"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      {hint ? (
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
      <div className="mt-2">{children}</div>
      {/*
       * The error sits in flow beneath the control rather than replacing
       * anything, so revealing it never resizes the field above it.
       */}
      {error ? (
        <p className="mt-1.5 text-xs font-bold text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A labelled text input. The label, hint and error are wired to the control by
 * id so screen readers announce them, which hand-rolled fields kept missing.
 */
export function TextField({
  label,
  hint,
  error,
  className,
  ...props
}: {
  label: string;
  hint?: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <Field error={error} hint={hint} htmlFor={id} label={label}>
      <input
        aria-describedby={cn(hintId, errorId) || undefined}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, error && INVALID, className)}
        id={id}
        {...props}
      />
    </Field>
  );
}

/**
 * A writing surface rather than a form control.
 *
 * Comfortable padding, a readable line height and a sensible minimum — but a
 * fixed maximum too. It does not auto-grow without limit: a description field
 * that expands forever turns a phone form into an endless page, so past its
 * height the textarea scrolls internally and the page does not move.
 */
export function TextAreaField({
  label,
  hint,
  error,
  className,
  rows = 4,
  maxLength,
  value,
  ...props
}: {
  label: string;
  hint?: string;
  error?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const used = typeof value === "string" ? value.length : 0;
  // Counted only near the limit: a number under every field is noise, a number
  // when you are running out of room is help.
  const showCount = Boolean(maxLength) && used > maxLength! * 0.75;
  return (
    <Field error={error} hint={hint} htmlFor={id} label={label}>
      <textarea
        aria-describedby={cn(hintId, errorId) || undefined}
        aria-invalid={error ? true : undefined}
        className={cn(
          CONTROL,
          "max-h-[40vh] resize-y py-3 leading-7",
          error && INVALID,
          className,
        )}
        id={id}
        maxLength={maxLength}
        rows={rows}
        value={value}
        {...props}
      />
      {showCount ? (
        <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
          {used} / {maxLength}
        </p>
      ) : null}
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className,
  children,
  ...props
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Field error={error} hint={hint} htmlFor={id} label={label}>
      <select
        aria-invalid={error ? true : undefined}
        // `appearance-none` plus room on the right for the chevron the browser
        // draws, so the arrow never sits on top of a long option.
        className={cn(
          CONTROL,
          "appearance-none pr-10",
          error && INVALID,
          className,
        )}
        id={id}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
}

/**
 * A titled group of fields. Spacing carries the hierarchy — no card, because
 * cards inside cards inside cards is what the forms were already doing.
 */
export function FormSection({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-5">
      {title ? (
        <div>
          <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * A checkbox that is a real target, not a 16px square with text beside it.
 *
 * The whole row is the label, so the touch area is the row — the confirmation
 * checkboxes on the publishing forms were previously a bare input that a thumb
 * had to find exactly.
 */
export function CheckboxField({
  label,
  hint,
  className,
  ...props
}: {
  label: ReactNode;
  hint?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const id = useId();
  return (
    <div className={cn("block", className)}>
      <label
        className="flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm font-semibold text-foreground transition hover:border-kondo-green/40"
        htmlFor={id}
      >
        <input
          className="mt-0.5 h-4 w-4 shrink-0 accent-kondo-green"
          id={id}
          type="checkbox"
          {...props}
        />
        <span className="min-w-0 flex-1 leading-6">
          {label}
          {hint ? (
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              {hint}
            </span>
          ) : null}
        </span>
      </label>
    </div>
  );
}

/**
 * One choice from a few. A radio group rather than a select, because for three
 * or four options a list you can see beats a menu you have to open — and unlike
 * a select it says what the alternatives are without being touched.
 */
export function RadioGroupField<T extends string>({
  label,
  hint,
  error,
  options,
  value,
  onValueChange,
  columns = 1,
}: {
  label: string;
  hint?: string;
  error?: string;
  options: ReadonlyArray<{ value: T; label: string; hint?: string }>;
  value: T;
  onValueChange: (value: T) => void;
  columns?: 1 | 2;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="text-sm font-black text-foreground">{label}</legend>
      {hint ? (
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
      <div
        className={cn(
          "mt-2 grid gap-2",
          columns === 2 ? "sm:grid-cols-2" : undefined,
        )}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              className={cn(
                "flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition",
                selected
                  ? "border-kondo-green bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
                  : "border-border bg-card text-foreground hover:border-kondo-green/40",
              )}
              key={option.value}
            >
              <input
                checked={selected}
                className="h-4 w-4 shrink-0 accent-kondo-green"
                name={name}
                onChange={() => onValueChange(option.value)}
                type="radio"
                value={option.value}
              />
              <span className="min-w-0 flex-1">
                {option.label}
                {option.hint ? (
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {option.hint}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs font-bold text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** An on/off setting. The control is the row, so the whole thing is tappable. */
export function SwitchField({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label
      className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition hover:border-kondo-green/40"
      htmlFor={id}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-foreground">
          {label}
        </span>
        {hint ? (
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-kondo-green" : "bg-muted",
          disabled && "opacity-60",
        )}
      >
        <input
          aria-label={label}
          checked={checked}
          className="peer sr-only"
          disabled={disabled}
          id={id}
          onChange={(event) => onCheckedChange(event.target.checked)}
          role="switch"
          type="checkbox"
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </span>
    </label>
  );
}
