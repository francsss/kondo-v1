"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useRef } from "react";
import { KondoLogo } from "@/components/KondoLogo";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export type OnboardingStepDefinition = {
  key: string;
  label: string;
  title: string;
  description: string;
};

/**
 * Shared premium frame for both onboarding flows: aura background, one card,
 * a single progress language, and an always-reachable action bar on mobile.
 */
export function OnboardingShell({
  steps,
  step,
  eyebrow,
  onBack,
  backDisabled,
  action,
  hint,
  error,
  children,
  headerAction,
}: {
  steps: readonly OnboardingStepDefinition[];
  step: number;
  eyebrow: string;
  onBack: () => void;
  backDisabled?: boolean;
  action: React.ReactNode;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  const current = steps[step];
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [error]);

  return (
    <main className="relative min-h-[100dvh] bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(120%_100%_at_50%_0%,rgb(var(--brand)/0.16),transparent_70%)]"
      />
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between gap-3 pt-5 sm:pt-7">
          <KondoLogo href="/" size="sm" />
          {headerAction}
        </header>

        <OnboardingProgress step={step} steps={steps} />

        <div className="flex-1 pb-8">
          <section className="rounded-4xl border border-border bg-card p-5 text-card-foreground shadow-soft sm:p-8">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-kondo-green">
              {eyebrow}
            </p>
            <h1 className="mt-2.5 text-balance text-[26px] font-black leading-[1.15] tracking-[-0.035em] text-kondo-ink dark:text-white sm:text-3xl">
              {current.title}
            </h1>
            <p className="mt-2 text-pretty text-sm leading-6 text-muted-foreground">
              {current.description}
            </p>

            <div className="mt-7">{children}</div>

            {error ? (
              <p
                className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300"
                ref={errorRef}
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </section>
        </div>

        <div className="sticky bottom-0 -mx-4 mt-auto border-t border-border/70 bg-background/85 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
          {hint ? (
            <p
              aria-live="polite"
              className="mb-2.5 text-center text-xs font-semibold text-muted-foreground sm:text-left"
            >
              {hint}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <Button
              className="shrink-0"
              disabled={backDisabled}
              onClick={onBack}
              type="button"
              variant="ghost"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Back</span>
            </Button>
            {action}
          </div>
        </div>
      </div>
    </main>
  );
}

function OnboardingProgress({
  steps,
  step,
}: {
  steps: readonly OnboardingStepDefinition[];
  step: number;
}) {
  return (
    <nav aria-label="Onboarding progress" className="py-5 sm:py-7">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <p className="text-sm font-black tracking-tight text-kondo-ink dark:text-white">
          {steps[step].label}
        </p>
        <p className="text-xs font-bold tabular-nums text-muted-foreground">
          Step {step + 1} of {steps.length}
        </p>
      </div>
      <ol className="flex items-center gap-1.5">
        {steps.map((item, index) => (
          <li
            aria-current={index === step ? "step" : undefined}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            key={item.key}
          >
            <span className="sr-only">
              {item.label}
              {index < step
                ? " — completed"
                : index === step
                  ? " — current"
                  : ""}
            </span>
            <span
              className={cn(
                "block h-full rounded-full bg-kondo-green transition-[width] duration-500 ease-out motion-reduce:transition-none",
                index <= step ? "w-full" : "w-0",
              )}
            />
          </li>
        ))}
      </ol>
    </nav>
  );
}
