"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, LoaderCircle, Send, X } from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/Button";
import {
  KONDO_PET_DISPLAY_DELAY_MS,
  KONDO_PET_SUBMISSION_SNOOZE_MS,
  KONDO_PET_VISIBLE_DURATION_MS,
  isKondoPetPath,
  kondoPetSessionKey,
} from "@/lib/kondo-pet";
import { captureProductEvent } from "@/lib/product-analytics-client";
import {
  normalizeAnalyticsRoute,
  productAreaForPath,
  PRODUCT_EVENTS,
} from "@/lib/product-analytics-events";

const categories = [
  { value: "BUG", label: "Bug" },
  { value: "SUGGESTION", label: "Suggestion" },
  { value: "IDEA", label: "Idée" },
  { value: "EXPERIENCE", label: "Expérience" },
  { value: "OTHER", label: "Autre" },
] as const;

type FeedbackCategory = (typeof categories)[number]["value"];
const snoozeKey = "kondo-pet:snooze-until";

export function KondoPet({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("SUGGESTION");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const openedAtRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const successTimerRef = useRef(0);
  const eligible = enabled && mounted && isKondoPetPath(pathname);
  const analyticsProperties = useMemo(
    () => ({
      area: productAreaForPath(pathname),
      route: normalizeAnalyticsRoute(pathname),
    }),
    [pathname],
  );

  useEffect(() => {
    const resetTimer = window.setTimeout(() => setVisible(false), 0);
    if (!eligible) {
      return () => window.clearTimeout(resetTimer);
    }

    const sessionKey = kondoPetSessionKey(pathname);
    let seenThisSession = false;
    let snoozeUntil = 0;
    try {
      seenThisSession = Boolean(window.sessionStorage.getItem(sessionKey));
      snoozeUntil = Number(window.localStorage.getItem(snoozeKey) ?? 0);
    } catch {
      // Storage can be unavailable in privacy-restricted browsers. The
      // in-memory `displayed` guard still prevents repeated appearances.
    }
    if (seenThisSession || snoozeUntil > Date.now()) {
      return () => window.clearTimeout(resetTimer);
    }

    let displayed = false;
    let displayTimer = 0;
    let hideTimer = 0;

    function scheduleDisplay() {
      if (displayed) return;
      window.clearTimeout(displayTimer);
      displayTimer = window.setTimeout(() => {
        if (document.visibilityState !== "visible") {
          scheduleDisplay();
          return;
        }
        displayed = true;
        try {
          window.sessionStorage.setItem(sessionKey, "1");
        } catch {
          // Keep the current in-memory guard when session storage is blocked.
        }
        setVisible(true);
        captureProductEvent(PRODUCT_EVENTS.PET_DISPLAYED, analyticsProperties);
        hideTimer = window.setTimeout(
          () => setVisible(false),
          KONDO_PET_VISIBLE_DURATION_MS,
        );
      }, KONDO_PET_DISPLAY_DELAY_MS);
    }

    const onActivity = () => scheduleDisplay();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") scheduleDisplay();
      else window.clearTimeout(displayTimer);
    };

    scheduleDisplay();
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("scroll", onActivity, { passive: true });
    window.addEventListener("touchstart", onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(resetTimer);
      window.clearTimeout(displayTimer);
      window.clearTimeout(hideTimer);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("scroll", onActivity);
      window.removeEventListener("touchstart", onActivity);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [analyticsProperties, eligible, pathname]);

  useEffect(() => () => window.clearTimeout(successTimerRef.current), []);

  const cancelFeedback = useCallback(() => {
    if (!modalOpen || pending) return;
    window.clearTimeout(successTimerRef.current);
    if (!submitted) {
      captureProductEvent(PRODUCT_EVENTS.FEEDBACK_CANCELLED, {
        ...analyticsProperties,
        duration_ms: Math.max(
          0,
          Math.round(performance.now() - openedAtRef.current),
        ),
      });
    }
    setModalOpen(false);
    setVisible(false);
  }, [analyticsProperties, modalOpen, pending, submitted]);

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(
      () => textareaRef.current?.focus(),
      80,
    );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        cancelFeedback();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href]",
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [cancelFeedback, modalOpen, pending]);

  function openFeedback() {
    openedAtRef.current = performance.now();
    setError("");
    setSubmitted(false);
    setModalOpen(true);
    captureProductEvent(PRODUCT_EVENTS.PET_CLICKED, analyticsProperties);
    captureProductEvent(
      PRODUCT_EVENTS.FEEDBACK_MODAL_OPENED,
      analyticsProperties,
    );
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || message.trim().length < 4) return;
    setPending(true);
    setError("");
    const durationMs = Math.max(
      0,
      Math.round(performance.now() - openedAtRef.current),
    );
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message,
          pagePath: pathname,
          submittedAfterMs: Math.min(durationMs, 60 * 60 * 1000),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Votre avis n’a pas pu être envoyé.");
      }
      captureProductEvent(PRODUCT_EVENTS.FEEDBACK_SUBMITTED, {
        ...analyticsProperties,
        category: category.toLowerCase(),
        duration_ms: durationMs,
      });
      try {
        window.localStorage.setItem(
          snoozeKey,
          String(Date.now() + KONDO_PET_SUBMISSION_SNOOZE_MS),
        );
      } catch {
        // A successful submission remains successful when storage is blocked.
      }
      setSubmitted(true);
      setMessage("");
      successTimerRef.current = window.setTimeout(
        () => {
          setModalOpen(false);
          setVisible(false);
        },
        reducedMotion ? 900 : 1_800,
      );
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Une erreur est survenue. Réessayez dans un instant.",
      );
    } finally {
      setPending(false);
    }
  }

  if (!eligible) return null;

  return (
    <>
      <AnimatePresence>
        {visible && !modalOpen ? (
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="fixed bottom-24 right-3 z-[45] flex items-end gap-2 sm:right-5 lg:bottom-6 lg:right-6"
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            initial={reducedMotion ? false : { opacity: 0, scale: 0.88, y: 16 }}
            transition={{ duration: reducedMotion ? 0 : 0.35, ease: "easeOut" }}
          >
            <motion.p
              animate={{ opacity: 1, x: 0 }}
              className="mb-3 hidden max-w-40 rounded-2xl border border-border bg-card/95 px-3.5 py-2.5 text-xs font-bold leading-4 text-card-foreground shadow-soft backdrop-blur sm:block"
              initial={reducedMotion ? false : { opacity: 0, x: 8 }}
              transition={{ delay: reducedMotion ? 0 : 0.18 }}
            >
              Une idée pour améliorer Kondo&nbsp;?
            </motion.p>
            <motion.button
              aria-label="Donner votre avis à Kondo"
              className="group relative grid h-[84px] w-[84px] place-items-center rounded-[28px] border border-emerald-200/80 bg-gradient-to-br from-white/95 to-emerald-50/95 p-1.5 shadow-[0_16px_45px_rgba(16,80,64,0.22)] outline-none backdrop-blur transition focus-visible:ring-4 focus-visible:ring-emerald-300/50 dark:border-emerald-400/20 dark:from-slate-900/95 dark:to-emerald-950/95 sm:h-24 sm:w-24"
              onClick={openFeedback}
              type="button"
              whileHover={reducedMotion ? undefined : { scale: 1.04, y: -2 }}
              whileTap={reducedMotion ? undefined : { scale: 0.96 }}
            >
              <motion.span
                animate={
                  reducedMotion
                    ? undefined
                    : {
                        y: [0, -3, 0],
                        rotate: [0, 1.2, 0, -0.8, 0],
                      }
                }
                className="block"
                transition={{
                  duration: 3,
                  ease: "easeInOut",
                  repeat: 2,
                }}
              >
                <Image
                  alt=""
                  aria-hidden="true"
                  className="h-[74px] w-[74px] object-contain drop-shadow-sm sm:h-[86px] sm:w-[86px]"
                  draggable={false}
                  height={112}
                  priority={false}
                  src="/mascot/kondo-pet.png"
                  width={112}
                />
              </motion.span>
              <span className="absolute -bottom-1 rounded-full bg-kondo-ink px-2 py-0.5 text-[9px] font-black text-white shadow-sm dark:bg-emerald-400 dark:text-kondo-ink">
                Feedback
              </span>
            </motion.button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {modalOpen ? (
          <motion.div
            animate={{ opacity: 1 }}
            aria-label="Partager votre avis"
            aria-modal="true"
            className="fixed inset-0 z-[80] grid items-end bg-slate-950/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-5"
            exit={{ opacity: 0 }}
            initial={reducedMotion ? false : { opacity: 0 }}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) cancelFeedback();
            }}
            role="dialog"
          >
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[32px] border border-border bg-card p-5 text-card-foreground shadow-2xl sm:max-w-[520px] sm:rounded-[32px] sm:p-7"
              exit={{ opacity: 0, scale: 0.97, y: 16 }}
              initial={
                reducedMotion ? false : { opacity: 0, scale: 0.97, y: 22 }
              }
              onMouseDown={(event) => event.stopPropagation()}
              ref={dialogRef}
              transition={{
                duration: reducedMotion ? 0 : 0.24,
                ease: "easeOut",
              }}
            >
              <Button
                aria-label="Fermer"
                className="absolute right-4 top-4 rounded-full"
                disabled={pending}
                onClick={cancelFeedback}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>

              {submitted ? (
                <div className="px-2 py-12 text-center" role="status">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                    <CheckCircle2 className="h-7 w-7" />
                  </span>
                  <h2 className="mt-5 text-xl font-black tracking-tight text-kondo-ink dark:text-white">
                    Merci, votre avis compte.
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    L’équipe Kondo pourra maintenant l’étudier.
                  </p>
                </div>
              ) : (
                <form onSubmit={submitFeedback}>
                  <div className="flex items-center gap-3 pr-10">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-3xl bg-emerald-50 dark:bg-emerald-400/10">
                      <Image
                        alt=""
                        aria-hidden="true"
                        className="h-12 w-12 object-contain"
                        height={56}
                        src="/mascot/kondo-pet.png"
                        width={56}
                      />
                    </span>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-kondo-green">
                        Kondo Pet
                      </p>
                      <h2 className="mt-1 text-xl font-black leading-6 tracking-[-0.03em] text-kondo-ink dark:text-white sm:text-2xl">
                        Votre avis nous aide à améliorer Kondo
                      </h2>
                    </div>
                  </div>

                  <label className="mt-6 block">
                    <span className="text-xs font-black text-kondo-ink dark:text-white">
                      Type de retour
                    </span>
                    <select
                      className="mt-2 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-kondo-green focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-400/10"
                      onChange={(event) =>
                        setCategory(event.target.value as FeedbackCategory)
                      }
                      value={category}
                    >
                      {categories.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mt-4 block">
                    <span className="text-xs font-black text-kondo-ink dark:text-white">
                      Votre retour
                    </span>
                    <textarea
                      className="mt-2 min-h-32 w-full resize-y rounded-2xl border border-border bg-background p-4 text-sm leading-6 outline-none transition placeholder:text-muted-foreground/70 focus:border-kondo-green focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-400/10"
                      maxLength={2000}
                      minLength={4}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Ce que vous aimez, un problème rencontré ou une idée…"
                      ref={textareaRef}
                      required
                      value={message}
                    />
                    <span className="mt-1.5 block text-right text-[10px] text-muted-foreground">
                      {message.length}/2000
                    </span>
                  </label>

                  {error ? (
                    <p
                      aria-live="polite"
                      className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300"
                    >
                      {error}
                    </p>
                  ) : null}

                  <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                    <p className="mr-auto text-[10px] leading-4 text-muted-foreground">
                      Votre texte reste dans Kondo et n’est jamais envoyé à
                      PostHog.
                    </p>
                    <Button
                      className="shrink-0"
                      disabled={pending || message.trim().length < 4}
                      type="submit"
                    >
                      {pending ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {pending ? "Envoi…" : "Envoyer"}
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
