"use client";

import { Check, Languages } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/Card";

type AppLanguage = "ENGLISH" | "FRENCH" | "CHINESE" | "ARABIC";

const languages = [
  { value: "ENGLISH" as const, name: "English", nativeName: "English" },
  { value: "FRENCH" as const, name: "French", nativeName: "Français" },
  { value: "CHINESE" as const, name: "Chinese", nativeName: "中文" },
  { value: "ARABIC" as const, name: "Arabic", nativeName: "العربية" },
];

export function LanguageSettings({
  initialLanguage,
}: {
  initialLanguage: AppLanguage;
}) {
  const [selected, setSelected] = useState(initialLanguage);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function choose(language: AppLanguage) {
    const previous = selected;
    setSelected(language);
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error ?? "Language preference was not saved.");
      }
      setFeedback("Language preference saved.");
    } catch (error) {
      setSelected(previous);
      setFeedback(
        error instanceof Error
          ? error.message
          : "Language preference was not saved.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3 rounded-2xl bg-kondo-mint/70 p-4 dark:bg-emerald-400/10">
        <Languages className="mt-0.5 h-5 w-5 text-kondo-green" />
        <p className="text-sm leading-6 text-kondo-forest dark:text-emerald-200">
          Your preference is saved now. English remains the complete product
          language until each translation is reviewed across navigation,
          safety, content, and moderation.
        </p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {languages.map((language) => {
          const active = selected === language.value;
          return (
            <button
              aria-pressed={active}
              className={
                active
                  ? "rounded-3xl border-2 border-kondo-green bg-kondo-mint/40 p-5 text-left dark:bg-emerald-400/10"
                  : "rounded-3xl border border-slate-200 bg-slate-50 p-5 text-left dark:border-white/10 dark:bg-white/[0.03]"
              }
              disabled={pending}
              key={language.value}
              onClick={() => choose(language.value)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-kondo-ink dark:text-white">
                    {language.nativeName}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {language.name}
                  </p>
                </div>
                {active ? (
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-kondo-green text-white">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                ) : null}
              </div>
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
