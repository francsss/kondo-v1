import type { DiscoverContext, DiscoverItem } from "@/features/discover/types";
import { discoverProvider } from "@/features/discover/registry";
import { listPublicCatalog } from "@/lib/organization-catalog";

export type EssentialSection = {
  key: string;
  title: string;
  description: string;
  items: DiscoverItem[];
};

const themes = [
  {
    key: "preparing-to-arrive",
    title: "Preparing to arrive",
    description: "Real services and essentials that can make arrival clearer.",
    terms: ["arrival", "airport", "pickup", "visa", "orientation"],
  },
  {
    key: "housing-essentials",
    title: "Housing essentials",
    description: "Published homes, bedding, starter kits and practical setup.",
    terms: ["housing", "bedding", "starter", "furniture", "home"],
  },
  {
    key: "connectivity-study",
    title: "Connectivity & study",
    description: "SIM, connectivity and study essentials from real providers.",
    terms: ["sim", "connectivity", "internet", "study", "stationery"],
  },
  {
    key: "career-preparation",
    title: "Career preparation",
    description: "Real services for CVs, applications and career readiness.",
    terms: ["career", "cv", "resume", "interview", "application"],
  },
] as const;

function catalogDiscoverItem(
  item: Awaited<ReturnType<typeof listPublicCatalog>>[number],
): DiscoverItem {
  const type = item.kind === "product" ? "products" : "services";
  return {
    id: item.id,
    type,
    title: item.title,
    description: item.shortDescription,
    href: item.href,
    eyebrow:
      item.kind === "product" ? "Organization product" : "Organization service",
    location: item.locationLabel ?? item.city?.name ?? null,
    imageUrl: item.media[0]?.url ?? item.organization.logoUrl,
    metadata: [item.priceLabel, item.organization.name],
    recommendationReason: null,
    analytics: {
      resourceType: type,
      sourceDomain: `organization-${item.kind}`,
    },
  };
}

/** Personalized projection only: source records remain owned by their domains. */
export async function getKondoEssentials(context: DiscoverContext) {
  const [products, services, housing, marketplace] = await Promise.all([
    listPublicCatalog({
      kind: "product",
      cityId: context.cityId ?? undefined,
      limit: 40,
    }),
    listPublicCatalog({
      kind: "service",
      cityId: context.cityId ?? undefined,
      limit: 40,
    }),
    discoverProvider("housing").search(context, {
      cityId: context.cityId ?? undefined,
      limit: 6,
    }),
    discoverProvider("marketplace").search(context, {
      cityId: context.cityId ?? undefined,
      limit: 12,
    }),
  ]);
  const catalog = [...products, ...services].map(catalogDiscoverItem);
  const searchable = [...catalog, ...marketplace];
  const sections: EssentialSection[] = themes.flatMap((theme) => {
    const items = searchable
      .filter((item) => {
        const content =
          `${item.title} ${item.description ?? ""} ${item.metadata.join(" ")}`.toLowerCase();
        return theme.terms.some((term) => content.includes(term));
      })
      .slice(0, 8);
    if (theme.key === "housing-essentials") {
      items.unshift(...housing.slice(0, Math.max(0, 8 - items.length)));
    }
    const unique = [
      ...new Map(
        items.map((item) => [`${item.type}:${item.id}`, item]),
      ).values(),
    ].slice(0, 8);
    return unique.length
      ? [
          {
            key: theme.key,
            title: theme.title,
            description: theme.description,
            items: unique,
          },
        ]
      : [];
  });

  // If the database has real catalog content but none matches a named theme,
  // keep it discoverable under a neutral heading rather than inventing stock.
  if (!sections.length && catalog.length) {
    sections.push({
      key: "local-student-services",
      title: "Local student essentials",
      description:
        "Published products and services available from real organizations.",
      items: catalog.slice(0, 8),
    });
  }
  return sections;
}
