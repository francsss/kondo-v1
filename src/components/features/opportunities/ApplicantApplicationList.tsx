import Link from "next/link";
import { ClampedTitle } from "@/components/ui/ClampedText";

/**
 * The signed-in applicant's own applications, grouped by what each one needs
 * next. One implementation shared by the Student Hub section and the personal
 * Opportunities account route.
 */

const SECTIONS = [
  { key: "drafts", label: "Drafts" },
  { key: "action-required", label: "Action required" },
  { key: "in-review", label: "In review" },
  { key: "interviews", label: "Interviews" },
  { key: "offers", label: "Offers" },
  { key: "completed", label: "Completed" },
] as const;

export type ApplicantApplication = {
  id: string;
  bucket: string;
  statusLabel: string;
  submittedAt: string | null;
  opportunity: {
    title: string;
    organizationName: string | null;
    available: boolean;
  };
};

export function ApplicantApplicationList({
  applications,
  emptyTitle,
  emptyBody,
  browseHref,
  browseLabel,
}: {
  applications: ApplicantApplication[];
  emptyTitle: string;
  emptyBody: string;
  browseHref: string;
  browseLabel: string;
}) {
  if (applications.length === 0) {
    return (
      <div className="mt-8 rounded-3xl border border-dashed border-border p-10 text-center">
        <h2 className="text-lg font-black">{emptyTitle}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {emptyBody}
        </p>
        <Link
          className="mt-5 inline-flex min-h-11 items-center rounded-full bg-secondary px-5 text-sm font-black text-secondary-foreground transition hover:bg-secondary/75"
          href={browseHref}
        >
          {browseLabel}
        </Link>
      </div>
    );
  }

  return (
    <>
      {SECTIONS.map((section) => {
        const items = applications.filter(
          (application) => application.bucket === section.key,
        );
        // Only sections with real content are rendered.
        if (items.length === 0) return null;
        return (
          <section className="mt-8" key={section.key}>
            <h2 className="text-lg font-black tracking-[-0.02em]">
              {section.label}
            </h2>
            <ul className="mt-3 space-y-3">
              {items.map((application) => (
                <li
                  className="rounded-3xl border border-border bg-card p-4 transition hover:border-foreground/20"
                  key={application.id}
                >
                  <Link
                    className="block"
                    href={`/opportunities/applications/${application.id}`}
                  >
                    <ClampedTitle className="block font-black leading-snug">
                      {application.opportunity.title}
                    </ClampedTitle>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {application.opportunity.organizationName
                        ? `${application.opportunity.organizationName} · `
                        : ""}
                      {application.statusLabel}
                      {application.submittedAt
                        ? ` · submitted ${new Date(
                            application.submittedAt,
                          ).toLocaleDateString("en-GB")}`
                        : ""}
                    </p>
                    {!application.opportunity.available ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        This opportunity is no longer published. Your
                        application history is kept.
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
