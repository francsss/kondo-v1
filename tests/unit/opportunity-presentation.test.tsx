import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LegacyScholarshipCard } from "@/components/features/student-hub/LegacyScholarshipCard";
import { OpportunityCard } from "@/components/features/opportunities/OpportunityCard";
import { ClampedTitle, ExpandableText } from "@/components/ui/ClampedText";

const LONG_TITLE =
  "Fully funded Chinese Government Scholarship for African postgraduate researchers in renewable energy systems and grid integration";
const LONG_DESCRIPTION = Array.from(
  { length: 14 },
  (_, index) =>
    `Sentence ${index + 1} describing eligibility, funding coverage and the documents an applicant must prepare.`,
).join(" ");

describe("long title clamping", () => {
  it("limits a title to two lines without altering the text", () => {
    const markup = renderToStaticMarkup(
      <ClampedTitle>{LONG_TITLE}</ClampedTitle>,
    );
    expect(markup).toContain("line-clamp-2");
    // Clipping is presentational: the complete title stays in the document.
    expect(markup).toContain("renewable energy systems and grid integration");
  });

  it("supports a stricter single-line clamp for dense rails", () => {
    const markup = renderToStaticMarkup(
      <ClampedTitle lines={1}>{LONG_TITLE}</ClampedTitle>,
    );
    expect(markup).toContain("line-clamp-1");
  });
});

describe("long description expansion", () => {
  it("collapses to four lines and keeps the full text in the document", () => {
    const markup = renderToStaticMarkup(
      <ExpandableText text={LONG_DESCRIPTION} />,
    );
    expect(markup).toContain("line-clamp-4");
    expect(markup).toContain("Sentence 14");
  });

  it("renders no control before measurement, so hydration cannot mismatch", () => {
    // Whether the text is truncated depends on layout, which the server cannot
    // know. The control appears only after the client measures it.
    const markup = renderToStaticMarkup(
      <ExpandableText text={LONG_DESCRIPTION} />,
    );
    expect(markup).not.toContain("See more");
    expect(markup).not.toContain("aria-expanded");
    // The collapsed paragraph itself is stable across server and client.
    expect(markup).toContain("line-clamp-4");
  });

  it("shows complete content with no control on detail pages", () => {
    const markup = renderToStaticMarkup(
      <ExpandableText collapsible={false} text={LONG_DESCRIPTION} />,
    );
    expect(markup).not.toContain("line-clamp");
    expect(markup).toContain("Sentence 14");
  });

  it("wires the control to the text it expands", () => {
    const source = readFileSync(
      new URL("../../src/components/ui/ClampedText.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("aria-controls");
    expect(source).toContain("aria-expanded");
    expect(source).toContain('type="button"');
  });
});

describe("opportunity card presentation", () => {
  const item = {
    id: "opportunity-1",
    href: "/opportunities/renewable-energy-scholarship",
    title: LONG_TITLE,
    summary: LONG_DESCRIPTION,
    typeLabel: "Scholarship",
    coverMediaId: null,
    coverAltText: null,
    location: "Beijing, China",
    compensationSummary: null,
    publisher: { name: "Kondo University", verified: true },
    applicationWindow: {
      state: "OPEN",
      deadline: null,
      rolling: false,
      timezone: "Asia/Shanghai",
    },
  };

  it("clamps the title and the summary on a card", () => {
    const markup = renderToStaticMarkup(
      <OpportunityCard item={item as never} />,
    );
    expect(markup).toContain("line-clamp-2");
    expect(markup).toContain("line-clamp-4");
  });

  it("states absent compensation rather than inventing a range", () => {
    const markup = renderToStaticMarkup(
      <OpportunityCard item={item as never} />,
    );
    expect(markup).toContain("Compensation not specified");
  });
});

describe("unified scholarship presentation", () => {
  const legacy = {
    id: "legacy-1",
    source: "LEGACY_SCHOLARSHIP" as const,
    title: "Provincial language programme grant",
    summary: LONG_DESCRIPTION,
    href: "/student-hub/scholarships/provincial-language-grant",
    provider: "Jiangsu Education Bureau",
    location: "Nanjing, China",
    fundingLabel: "Partially funded",
    deadline: "2026-09-30",
    typeLabel: "Scholarship",
  };

  it("presents a legacy record with its real publisher and no agent framing", () => {
    const markup = renderToStaticMarkup(
      <LegacyScholarshipCard item={legacy} />,
    );
    expect(markup).toContain("Published by Jiangsu Education Bureau");
    expect(markup).not.toContain("Scholarship agent");
    expect(markup).not.toContain("Legacy");
    expect(markup).not.toContain("LEGACY_SCHOLARSHIP");
  });

  it("keeps the legacy record's own canonical URL", () => {
    const markup = renderToStaticMarkup(
      <LegacyScholarshipCard item={legacy} />,
    );
    // No duplicate public scholarship URL is minted under /opportunities.
    expect(markup).toContain(
      "/student-hub/scholarships/provincial-language-grant",
    );
  });

  it("uses the same clamping as a unified opportunity card", () => {
    const markup = renderToStaticMarkup(
      <LegacyScholarshipCard item={legacy} />,
    );
    expect(markup).toContain("line-clamp-2");
    expect(markup).toContain("line-clamp-4");
  });
});

describe("scholarships page composition", () => {
  const source = readFileSync(
    new URL(
      "../../app/(student-hub)/student-hub/scholarships/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  it("no longer renders a public Opportunities / Scholarship agents tab split", () => {
    expect(source).not.toContain("ScholarshipNav");
  });

  it("draws only from real records and seeds no example scholarship", () => {
    expect(source).toContain("listLegacyScholarshipCards");
    expect(source).toContain("StudentHubOpportunitySection");
    expect(source).not.toMatch(/const\s+(SAMPLE|EXAMPLE|DEMO)_SCHOLARSHIPS/);
  });
});

describe("horizontal tab semantics", () => {
  const source = readFileSync(
    new URL("../../src/components/ui/HorizontalTabs.tsx", import.meta.url),
    "utf8",
  );

  it("announces route-changing tabs as navigation, not as a tablist", () => {
    expect(source).toContain('aria-current={active ? "page" : undefined}');
    expect(source).not.toContain('role="tab"');
    expect(source).not.toContain('role="tablist"');
  });

  it("respects the reduced-motion preference in both the row and the panel", () => {
    expect(source).toContain("useReducedMotion");
    expect(source).toContain("if (reducedMotion) return <div");
    expect(source).toContain('behavior: reducedMotion ? "auto" : "smooth"');
  });

  it("scrolls only the inline axis so the page never jumps", () => {
    expect(source).toContain("container.scrollTo({");
    expect(source).not.toContain("scrollIntoView");
  });
});
