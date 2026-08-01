"use client";

import { usePathname } from "next/navigation";
import { HorizontalTabs } from "@/components/ui/HorizontalTabs";

export function OrganizationSectionNavigation({
  sections,
  activeSection,
}: {
  sections: Array<{ key: string; label: string; accessibilityLabel: string }>;
  activeSection: string;
}) {
  const pathname = usePathname();

  return (
    <div className="sticky top-16 z-20 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto max-w-[1240px] px-4 py-2 sm:px-6 lg:px-8">
        <HorizontalTabs
          activeKey={activeSection}
          ariaLabel="Organization profile sections"
          tabs={sections.map((section) => ({
            key: section.key,
            label: section.label,
            href: `${pathname}?section=${encodeURIComponent(section.key)}`,
          }))}
        />
      </div>
    </div>
  );
}
