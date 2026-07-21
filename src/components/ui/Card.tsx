import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-[0_1px_2px_rgba(16,24,40,0.03)]",
        className,
      )}
      {...props}
    />
  );
}
