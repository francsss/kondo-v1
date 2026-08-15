"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { KONDO_CONTROL_CLASS } from "@/components/ui/Form";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  id: string;
  name: string;
  secondary?: string;
};

export function SearchableSelect({
  label,
  icon,
  options,
  selected,
  onSelect,
  placeholder,
  searchPlaceholder,
  emptyMessage = "No result found.",
  disabled = false,
  clearLabel,
}: {
  label: string;
  icon?: React.ReactNode;
  options: SearchableSelectOption[];
  selected: string;
  onSelect: (id: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage?: string;
  disabled?: boolean;
  clearLabel?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.id === selected);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      `${option.name} ${option.secondary ?? ""}`
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [options, query]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      {/* Same label treatment as the rest of the Kondo form primitives. */}
      <span
        className="mb-2 flex items-center gap-2 text-sm font-black text-foreground"
        id={`${id}-label`}
      >
        {icon ? (
          <span className="text-kondo-green [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
        ) : null}
        {label}
      </span>
      <button
        aria-controls={`${id}-options`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={`${id}-label`}
        className={cn(
          // The shared control shell, so a searchable select is the same
          // object as every other field rather than a taller cousin.
          KONDO_CONTROL_CLASS,
          "flex items-center gap-3 text-left",
          open && "border-kondo-green/55",
          disabled && "cursor-not-allowed opacity-55",
        )}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate font-semibold",
              selectedOption ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {selectedOption?.name ?? placeholder}
          </span>
          {selectedOption?.secondary ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {selectedOption.secondary}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-xl shadow-black/10 dark:shadow-black/30">
          <div className="border-b border-border p-3">
            <div className="kondo-field flex h-11 items-center gap-2 rounded-xl border border-border bg-background px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                aria-label={searchPlaceholder}
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                ref={inputRef}
                value={query}
              />
              {query ? (
                <button
                  aria-label="Clear search"
                  className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  onClick={() => setQuery("")}
                  type="button"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
          <div
            className="max-h-64 overflow-y-auto overscroll-contain p-2"
            id={`${id}-options`}
            role="listbox"
          >
            {clearLabel && !query ? (
              <button
                aria-selected={!selected}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                  !selected
                    ? "bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300"
                    : "text-foreground hover:bg-muted",
                )}
                onClick={() => {
                  onSelect("");
                  setOpen(false);
                  setQuery("");
                }}
                role="option"
                type="button"
              >
                <span className="min-w-0 flex-1 text-sm font-semibold">
                  {clearLabel}
                </span>
                {!selected ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            ) : null}
            {filteredOptions.length ? (
              filteredOptions.map((option) => (
                <button
                  aria-selected={selected === option.id}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                    selected === option.id
                      ? "bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300"
                      : "text-foreground hover:bg-muted",
                  )}
                  key={option.id}
                  onClick={() => {
                    onSelect(option.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  role="option"
                  type="button"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {option.name}
                    </span>
                    {option.secondary ? (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {option.secondary}
                      </span>
                    ) : null}
                  </span>
                  {selected === option.id ? (
                    <Check className="h-4 w-4 shrink-0" />
                  ) : null}
                </button>
              ))
            ) : (
              <div className="px-3 py-8 text-center">
                <Search className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  {emptyMessage}
                </p>
              </div>
            )}
          </div>
          <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            {filteredOptions.length}{" "}
            {filteredOptions.length === 1 ? "option" : "options"}
          </div>
        </div>
      ) : null}
    </div>
  );
}
