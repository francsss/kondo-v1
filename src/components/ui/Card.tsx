import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "surface hairline rounded-3xl border p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]",
        className,
      )}
      {...props}
    />
  );
}
