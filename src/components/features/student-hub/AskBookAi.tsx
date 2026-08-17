"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KONDO_CONTROL_CLASS } from "@/components/ui/Form";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

/**
 * Ask Kondo AI about the passage you selected.
 *
 * The passage stays on screen throughout, and the way back to it is the first
 * thing on the page — an answer is only useful next to the sentence that
 * prompted it, and a reader who has to hunt for their place will stop asking.
 *
 * Four canned questions before the free-text box, because most questions about
 * a passage are one of those four and typing on a phone is work.
 */

const QUICK = [
  { action: "explain", label: "Explain this" },
  { action: "translate", label: "Translate" },
  { action: "simplify", label: "Explain simply" },
  { action: "significance", label: "Why does this matter?" },
] as const;

export function AskBookAi({
  slug,
  selectedText,
  cfi,
  chapter,
}: {
  slug: string;
  selectedText: string;
  cfi: string | null;
  chapter: string | null;
}) {
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");

  async function ask(payload: { action?: string; question?: string }) {
    setPending(true);
    setError("");
    setAnswer("");
    captureProductEvent(PRODUCT_EVENTS.BOOK_AI_QUESTION_SENT, { slug });
    try {
      const response = await fetch(`/api/study/books/${slug}/ai`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedText,
          locator: cfi,
          chapter,
          ...payload,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Ask AI is unavailable right now.");
      }
      setAnswer(body.answer);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Ask AI is unavailable right now.",
      );
    } finally {
      setPending(false);
    }
  }

  const backHref = cfi
    ? `/student-hub/books/${slug}?at=${encodeURIComponent(cfi)}`
    : `/student-hub/books/${slug}`;

  return (
    <div
      className="mx-auto max-w-[680px] px-4 pb-16 pt-5"
      style={{ paddingBottom: "max(4rem, env(safe-area-inset-bottom))" }}
    >
      <Button asChild size="sm" variant="ghost">
        <Link href={backHref}>
          <ArrowLeft className="h-4 w-4" /> Back to passage
        </Link>
      </Button>

      <Card className="mt-4 p-5">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
          Selected passage
        </p>
        <blockquote className="mt-2 border-l-2 border-kondo-green pl-3 text-sm leading-6">
          {selectedText}
        </blockquote>
        {chapter ? (
          <p className="mt-2 text-xs text-muted-foreground">{chapter}</p>
        ) : null}
      </Card>

      <h1 className="mt-6 flex items-center gap-2 text-lg font-black">
        <Sparkles className="h-4 w-4 text-kondo-green" /> Ask Kondo AI
      </h1>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {QUICK.map((item) => (
          <Button
            disabled={pending}
            key={item.action}
            onClick={() => void ask({ action: item.action })}
            variant="secondary"
          >
            {item.label}
          </Button>
        ))}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (question.trim()) void ask({ question: question.trim() });
        }}
      >
        <input
          aria-label="Ask anything about this passage"
          className={KONDO_CONTROL_CLASS}
          maxLength={500}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask anything…"
          value={question}
        />
        <Button disabled={pending || !question.trim()} type="submit">
          Ask
        </Button>
      </form>

      {pending ? (
        <p className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          Thinking…
        </p>
      ) : null}

      {error ? (
        <Card className="mt-5 p-4" role="alert">
          <p className="text-sm font-bold text-destructive">{error}</p>
        </Card>
      ) : null}

      {answer ? (
        <Card className="mt-5 p-5">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
            Kondo AI
          </p>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-6">
            {answer}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Based on the passage you selected{chapter ? ` · ${chapter}` : ""}.
          </p>
          <Button asChild className="mt-3" size="sm" variant="secondary">
            <Link href={backHref}>Back to passage</Link>
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
