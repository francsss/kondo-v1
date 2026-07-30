"use client";

import { useEffect, useState } from "react";

export function OrganizationSectionNavigation({
  sections,
}: {
  sections: Array<{ key: string; label: string; accessibilityLabel: string }>;
}) {
  const [active, setActive] = useState(sections[0]?.key ?? "");

  useEffect(() => {
    const nodes = sections.flatMap(({ key }) => {
      const node = document.getElementById(key);
      return node ? [node] : [];
    });
    if (!nodes.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) => right.intersectionRatio - left.intersectionRatio,
          );
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      {
        rootMargin: "-25% 0px -60% 0px",
        threshold: [0, 0.15, 0.4],
      },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="Organization profile sections"
      className="sticky top-16 z-20 border-b border-border/80 bg-background/90 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-[1240px] gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-6 lg:px-8">
        {sections.map((section) => (
          <a
            aria-current={active === section.key ? "location" : undefined}
            aria-label={section.accessibilityLabel}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kondo-green ${
              active === section.key
                ? "bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
                : "text-muted-foreground hover:bg-muted hover:text-kondo-green"
            }`}
            href={`#${section.key}`}
            key={section.key}
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
