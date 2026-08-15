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
