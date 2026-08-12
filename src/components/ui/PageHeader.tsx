import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  /**
   * Optional: a commerce page earns its space with products, not with a
   * paragraph explaining what a marketplace is.
   */
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
      <div>
        {eyebrow ? (
          <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-balance text-2xl font-black tracking-[-0.045em] text-foreground sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
