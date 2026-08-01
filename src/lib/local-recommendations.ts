import { listPublicCatalog } from "@/lib/organization-catalog";
import { prisma } from "@/lib/prisma";

/**
 * Personalized Food & Services and Student Skills recommendations.
 *
 * One provider, queried by Home. Every result is read from its source domain
 * through that domain's own public projection, so a paused, removed, rejected
 * or suspended record disappears here the moment it disappears everywhere else.
 * Nothing is copied into a recommendation table.
 *
 * SIGNALS USED — all explicit, all volunteered by the member:
 *   city, university, country they selected, interests they picked, languages,
 *   journey stage, and what they have saved.
 *
 * SIGNALS NEVER USED — gender, ethnicity, race, religion, cultural identity,
 * nationality inferred from anything other than the country the member chose,
 * immigration status, or financial situation. In particular, hair and beauty
 * services are never recommended from gender: they require an interest the
 * member selected, a save, or a category they already engaged with.
 *
 * Every result carries the reason it appeared, phrased so the member can check
 * it against what they actually told Kondo.
 */

export type LocalRecommendationKind =
  "organization-product" | "organization-service" | "student-skill";

export type LocalRecommendation = {
  id: string;
  kind: LocalRecommendationKind;
  /** "Organization service · Food & Dining" */
  sourceLabel: string;
  title: string;
  description: string | null;
  href: string;
  publisher: string;
  category: string | null;
  /** City or approximate area only; never an exact address. */
  location: string | null;
  /** Only ever a real published price. */
  priceLabel: string | null;
  /** Only ever a real availability statement from the publisher. */
  availabilityLabel: string | null;
  imageUrl: string | null;
  reason: string;
  /** Ranking bucket, exposed for tests and stable ordering. */
  signal: RecommendationSignal;
};

/** Ordered by the priority the product gives them. */
export const RECOMMENDATION_SIGNALS = [
  "city",
  "university-area",
  "interest",
  "country",
  "saved-category",
  "journey",
  "local",
] as const;

export type RecommendationSignal = (typeof RECOMMENDATION_SIGNALS)[number];

/**
 * Ordering within the results.
 *
 * Locality is applied as a *filter* — the catalog and skill queries are already
 * scoped to the member's city — so every candidate shares the city signal.
 * Ranking by it again would only bury the signals that actually distinguish one
 * local result from another, so the explicit ones come first here.
 */
const SIGNAL_RANK: Record<RecommendationSignal, number> = {
  interest: 0,
  country: 1,
  "university-area": 2,
  "saved-category": 3,
  city: 4,
  journey: 5,
  local: 6,
};

export type RecommendationViewer = {
  id: string;
  cityId: string | null;
  cityName: string | null;
  universityName: string | null;
  countryName: string | null;
  interests: readonly string[];
  studentJourney: string | null;
};

/**
 * Loads only the fields the recommendation rules are allowed to read. Gender
 * is deliberately absent from the selection, so it cannot be used by accident.
 */
export async function loadRecommendationViewer(
  userId: string,
): Promise<RecommendationViewer | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      interests: true,
      studentJourney: true,
      city: { select: { id: true, name: true } },
      university: { select: { name: true } },
      country: { select: { name: true } },
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    cityId: user.city?.id ?? null,
    cityName: user.city?.name ?? null,
    universityName: user.university?.name ?? null,
    countryName: user.country?.name ?? null,
    interests: user.interests,
    studentJourney: user.studentJourney,
  };
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

/** Whether a record's category matches something the member explicitly picked. */
export function matchesInterest(
  category: string | null,
  interests: readonly string[],
) {
  if (!category || !interests.length) return null;
  const haystack = normalize(category);
  return (
    interests.find((interest) => {
      const needle = normalize(interest);
      return (
        needle.length > 2 &&
        (haystack.includes(needle) || needle.includes(haystack))
      );
    }) ?? null
  );
}

/**
 * Builds the sentence shown under a card. The wording names the signal the
 * member gave, never an inference about who they are.
 */
export function recommendationReason(input: {
  signal: RecommendationSignal;
  cityName: string | null;
  universityName: string | null;
  countryName: string | null;
  interest?: string | null;
  category?: string | null;
}): string {
  switch (input.signal) {
    case "city":
      return input.cityName
        ? `Recommended because you live in ${input.cityName}.`
        : "Available near you.";
    case "university-area":
      return input.universityName && input.cityName
        ? `Near your university area in ${input.cityName}.`
        : "Near your university area.";
    case "interest":
      return input.interest
        ? `Recommended because you selected ${input.interest}${
            input.cityName ? ` and live in ${input.cityName}` : ""
          }.`
        : "Recommended because of an interest you selected.";
    case "country":
      return input.countryName
        ? `Recommended because you selected ${input.countryName}${
            input.cityName ? ` and currently live in ${input.cityName}` : ""
          }.`
        : "Recommended because of the country you selected.";
    case "saved-category":
      return input.category
        ? `Recommended because you saved ${input.category.toLowerCase()}.`
        : "Recommended because of something you saved.";
    case "journey":
      return "Recommended for where you are in your student journey.";
    default:
      return input.cityName
        ? `Available in ${input.cityName}.`
        : "Available locally.";
  }
}

function catalogSourceLabel(
  kind: "product" | "service",
  category: string | null,
) {
  const base =
    kind === "product" ? "Organization product" : "Organization service";
  return category ? `${base} · ${category}` : base;
}

/**
 * Food & Services recommendations, read straight from the public catalog
 * projection so every visibility rule the catalog enforces applies here too.
 */
async function recommendCatalog(
  viewer: RecommendationViewer,
  limit: number,
): Promise<LocalRecommendation[]> {
  const [products, services] = await Promise.all([
    listPublicCatalog({
      kind: "product",
      cityId: viewer.cityId ?? undefined,
      limit: limit * 2,
    }),
    listPublicCatalog({
      kind: "service",
      cityId: viewer.cityId ?? undefined,
      limit: limit * 2,
    }),
  ]);

  return [...products, ...services].map((item) => {
    const interest = matchesInterest(item.category, viewer.interests);
    // A country signal is only ever used when the member selected that country
    // AND the publisher named it themselves in the title or category.
    const mentionsCountry =
      viewer.countryName &&
      `${item.title} ${item.category ?? ""}`
        .toLowerCase()
        .includes(normalize(viewer.countryName));
    const signal: RecommendationSignal = interest
      ? "interest"
      : mentionsCountry
        ? "country"
        : viewer.cityId
          ? "city"
          : "local";
    return {
      id: `${item.kind}:${item.id}`,
      kind:
        item.kind === "product"
          ? ("organization-product" as const)
          : ("organization-service" as const),
      sourceLabel: catalogSourceLabel(item.kind, item.category),
      title: item.title,
      description: item.shortDescription,
      href: item.href,
      publisher: item.organization.name,
      category: item.category,
      location: item.city?.name ?? item.locationLabel,
      priceLabel: item.priceLabel,
      availabilityLabel: item.availabilityLabel,
      imageUrl: item.media.find((media) => media.cover)?.url ?? null,
      reason: recommendationReason({
        signal,
        cityName: viewer.cityName,
        universityName: viewer.universityName,
        countryName: viewer.countryName,
        interest,
        category: item.category,
      }),
      signal,
    };
  });
}

/** Student Skills recommendations, from the student's own offers. */
async function recommendSkills(
  viewer: RecommendationViewer,
  limit: number,
): Promise<LocalRecommendation[]> {
  const rows = await prisma.studentSkillOffer.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
      // Never recommend the member their own offer.
      ownerId: { not: viewer.id },
      ...(viewer.cityId ? { cityId: viewer.cityId } : {}),
      owner: { status: "ACTIVE" },
    },
    select: {
      id: true,
      title: true,
      category: true,
      description: true,
      availability: true,
      city: { select: { name: true } },
      owner: {
        select: { firstName: true, lastName: true, username: true },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: limit * 2,
  });

  return rows.map((row) => {
    const interest = matchesInterest(row.category, viewer.interests);
    const signal: RecommendationSignal = interest
      ? "interest"
      : viewer.cityId
        ? "city"
        : "local";
    return {
      id: `skill:${row.id}`,
      kind: "student-skill" as const,
      sourceLabel: `Student skill · ${row.category}`,
      title: row.title,
      description: row.description,
      // Skills live on the Marketplace section, not on a private profile page.
      href: "/marketplace?view=skills",
      // First name only: a student skill never exposes a full private identity.
      publisher: row.owner.firstName,
      category: row.category,
      location: row.city?.name ?? null,
      // Students do not publish structured prices; nothing is invented.
      priceLabel: null,
      availabilityLabel: row.availability,
      imageUrl: null,
      reason: recommendationReason({
        signal,
        cityName: viewer.cityName,
        universityName: viewer.universityName,
        countryName: viewer.countryName,
        interest,
        category: row.category,
      }),
      signal,
    };
  });
}

/**
 * The Home rail. Deterministic: ranked by signal priority, then by title, so
 * two identical requests produce the same order. Never cached across members.
 */
export async function recommendLocalResources(input: {
  userId: string;
  limit?: number;
}): Promise<{
  items: LocalRecommendation[];
  viewer: RecommendationViewer | null;
}> {
  const limit = Math.min(12, Math.max(1, input.limit ?? 6));
  const viewer = await loadRecommendationViewer(input.userId);
  if (!viewer) return { items: [], viewer: null };

  const [catalog, skills] = await Promise.all([
    recommendCatalog(viewer, limit),
    recommendSkills(viewer, limit),
  ]);

  const seen = new Set<string>();
  const items = [...catalog, ...skills]
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort(
      (first, second) =>
        SIGNAL_RANK[first.signal] - SIGNAL_RANK[second.signal] ||
        first.title.localeCompare(second.title) ||
        first.id.localeCompare(second.id),
    )
    .slice(0, limit);

  return { items, viewer };
}
