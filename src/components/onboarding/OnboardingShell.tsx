"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useRef } from "react";
import { KondoLogo } from "@/components/KondoLogo";
import { Button } from "@/components/ui/Button";
import { useKeyboardAwareFocus } from "@/lib/use-keyboard-aware-focus";
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

  // The field being typed in stays above the keyboard, in every step, rather
  // than each one solving it for itself.
  useKeyboardAwareFocus();

  useEffect(() => {
    if (!error) return;
    /*
     * Only move if the message is not already on screen. Centring
     * unconditionally scrolled the page every time a validation error
     * re-rendered, including when the error was the thing the member was
     * already looking at.
     */
    const node = errorRef.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    const viewport = window.visualViewport;
    const visibleTop = viewport?.offsetTop ?? 0;
    const visibleBottom = visibleTop + (viewport?.height ?? window.innerHeight);
    if (box.top >= visibleTop && box.bottom <= visibleBottom) return;
    node.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [error]);

  return (
    <main className="relative min-h-[100dvh] bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(120%_100%_at_50%_0%,rgb(var(--brand)/0.16),transparent_70%)]"
      />
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between gap-3 pt-4 sm:pt-7">
          <KondoLogo href="/" size="sm" />
          {headerAction}
        </header>

        <OnboardingProgress step={step} steps={steps} />

        {/*
         * Bottom padding grows by the height the keyboard takes, so the last
         * control in a step has somewhere to scroll to. Zero when no keyboard
         * is open.
         */}
        <div className="flex-1 pb-6 pb-[calc(theme(spacing.6)+100dvh-var(--visual-viewport-height,100dvh))]">
          <section className="rounded-4xl border border-border bg-card p-4 text-card-foreground shadow-soft sm:p-8">
            {/*
             * The eyebrow is desktop-only. On a phone it was a fourth line of
             * chrome — logo, progress, eyebrow, title, description — above the
             * first thing anyone can actually answer, and it repeats what the
             * progress row already says.
             */}
            <p className="hidden text-[11px] font-black uppercase tracking-[0.18em] text-kondo-green sm:block">
              {eyebrow}
            </p>
            <h1 className="text-balance text-[22px] font-black leading-[1.15] tracking-[-0.035em] text-kondo-ink dark:text-white sm:mt-2.5 sm:text-3xl">
              {current.title}
            </h1>
            <p className="mt-1.5 text-pretty text-[13px] leading-5 text-muted-foreground sm:text-sm sm:leading-6">
              {current.description}
            </p>

            <div className="mt-5 sm:mt-7">{children}</div>

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

        {/*
         * Lifted onto the keyboard rather than left under it. `sticky bottom-0`
         * pins to the layout viewport, which is exactly the part the keyboard
         * covers, so Continue was unreachable on the steps with a text field.
         * The visual viewport is what remains visible; translating by the
         * difference puts the bar on top of the keys, and the difference is
         * zero when no keyboard is open.
         */}
        <div className="sticky bottom-0 -mx-4 mt-auto translate-y-[calc(var(--visual-viewport-height,100dvh)+var(--visual-viewport-offset-top,0px)-100dvh)] border-t border-border/70 bg-background/85 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl transition-transform duration-150 motion-reduce:transition-none sm:-mx-6 sm:px-6">
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
    <nav aria-label="Onboarding progress" className="py-3.5 sm:py-7">
      <div className="mb-2 flex items-baseline justify-between gap-3 sm:mb-2.5">
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
