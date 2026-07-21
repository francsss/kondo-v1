"use client";

import { ThumbsUp } from "lucide-react";
import { useState } from "react";

export function HelpfulButton({
  answerId,
  initialCount,
  initialHelpful,
}: {
  answerId: string;
  initialCount: number;
  initialHelpful: boolean;
}) {
  const [helpful, setHelpful] = useState(initialHelpful);
  const [count, setCount] = useState(initialCount);

  async function toggle() {
    const next = !helpful;
    setHelpful(next);
    setCount((value) => value + (next ? 1 : -1));
    const response = await fetch(`/api/answers/${answerId}/votes`, {
      method: next ? "PUT" : "DELETE",
    }).catch(() => null);
    if (!response?.ok) {
      setHelpful(!next);
      setCount((value) => value + (next ? -1 : 1));
    }
  }

  return (
    <button
      aria-pressed={helpful}
      className={
        helpful
          ? "mt-5 inline-flex items-center gap-1.5 rounded-full bg-kondo-mint px-3 py-2 text-xs font-bold text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300"
          : "mt-5 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-muted-foreground dark:bg-white/5 dark:text-muted-foreground"
      }
      onClick={toggle}
      type="button"
    >
      <ThumbsUp className="h-3.5 w-3.5" /> Helpful · {count}
    </button>
  );
}
