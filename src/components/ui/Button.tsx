import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  fullWidth?: boolean;
} & VariantProps<typeof buttonVariants>;

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kondo-green focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-kondo-ink text-white shadow-[0_10px_30px_rgba(16,24,40,0.18)] hover:-translate-y-0.5 hover:bg-kondo-forest dark:bg-emerald-400 dark:text-kondo-ink dark:hover:bg-emerald-300",
        secondary:
          "border border-slate-200 bg-white text-kondo-ink hover:border-kondo-green hover:bg-kondo-mint/60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10",
        ghost:
          "text-slate-600 hover:bg-slate-100 hover:text-kondo-ink dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white",
        soft: "bg-kondo-mint text-kondo-forest hover:bg-emerald-200 dark:bg-emerald-400/15 dark:text-emerald-300",
        danger: "bg-red-600 text-white hover:bg-red-700",
      },
      size: {
        sm: "h-9 px-4",
        md: "h-11 px-5",
        lg: "h-13 px-7 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export function Button({
  asChild = false,
  fullWidth = false,
  className = "",
  variant,
  size,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(
        buttonVariants({ variant, size }),
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
