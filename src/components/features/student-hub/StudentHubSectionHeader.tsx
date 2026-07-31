import {
  studentHubSection,
  type StudentHubSectionKey,
} from "@/lib/student-hub-sections";

/**
 * Section heading for a Student Hub category. The title comes from the section
 * registry so the page, the metadata and the active tab can never drift into
 * naming the same thing differently.
 */
export function StudentHubSectionHeader({
  sectionKey,
  children,
}: {
  sectionKey: StudentHubSectionKey;
  children?: React.ReactNode;
}) {
  const section = studentHubSection(sectionKey);
  return (
    <header>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-kondo-green">
        Student Hub
      </p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
        {section.title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        {section.description}
      </p>
      {children}
    </header>
  );
}
