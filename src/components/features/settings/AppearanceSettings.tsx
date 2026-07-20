"use client";

import { Check, Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";

type ThemePreference = "LIGHT" | "DARK" | "SYSTEM";

const options = [
  {
    value: "LIGHT" as const,
    label: "Light",
    description: "Always use Kondo's light appearance.",
    icon: Sun,
  },
  {
    value: "DARK" as const,
    label: "Dark",
    description: "Always use Kondo's dark appearance.",
    icon: Moon,
  },
  {
    value: "SYSTEM" as const,
    label: "System",
    description: "Follow the appearance selected on this device.",
    icon: Laptop,
  },
];

export function AppearanceSettings({
  initialTheme,
}: {
  initialTheme: ThemePreference;
}) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [selected, setSelected] = useState(initialTheme);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function choose(theme: ThemePreference) {
    const previous = selected;
    setSelected(theme);
    setTheme(theme.toLowerCase());
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error ?? "Theme was not saved.");
      setFeedback("Appearance saved for your account.");
      router.refresh();
    } catch (error) {
      setSelected(previous);
      setTheme(previous.toLowerCase());
      setFeedback(
        error instanceof Error ? error.message : "Theme was not saved.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map(({ value, label, description, icon: Icon }) => {
          const active = selected === value;
          return (
            <button
              aria-pressed={active}
              className={`relative rounded-3xl border p-5 text-left transition ${
                active
                  ? "border-kondo-green bg-kondo-mint/60 dark:bg-emerald-400/10"
                  : "border-slate-200 hover:border-emerald-200 dark:border-white/10"
              }`}
              disabled={pending}
              key={value}
              onClick={() => choose(value)}
              type="button"
            >
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-kondo-green shadow-sm dark:bg-white/10 dark:text-emerald-300">
                <Icon className="h-5 w-5" />
              </span>
              <span className="mt-4 block font-black text-kondo-ink dark:text-white">
                {label}
              </span>
              <span className="mt-1 block text-sm leading-6 text-slate-500 dark:text-slate-300">
                {description}
              </span>
              {active ? (
                <span className="absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full bg-kondo-green text-white">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {feedback ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">
          {feedback}
        </p>
      ) : null}
    </Card>
  );
}
