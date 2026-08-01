import { DISCOVER_PROVIDERS } from "@/features/discover/registry";
import type { DiscoverContext } from "@/features/discover/types";
import { chinaCityNativeName } from "@/lib/china-map-aliases";
import { resolvePublishedCity } from "@/lib/city-hub";
import { prisma } from "@/lib/prisma";

export function normalizeCityAlias(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[市\s_.]+/g, "-")
    .replace(/[^a-z0-9\u3400-\u9fff-]+/g, "")
    .replace(/^-+|-+$/g, "");
}

export async function resolveCityRecord(value: string) {
  const normalized = normalizeCityAlias(value);
  const candidates = await prisma.city.findMany({
    where: { isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      province: true,
      verified: true,
      country: { select: { name: true } },
    },
  });
  return (
    candidates.find((city) => {
      const native = chinaCityNativeName(city.id, city.name);
      return [city.slug, city.name, native]
        .filter(Boolean)
        .some(
          (candidate) => normalizeCityAlias(String(candidate)) === normalized,
        );
    }) ?? null
  );
}

/** City Hub is an aggregation; no provider record is copied into a city table. */
export async function getDynamicCityHub(
  citySlug: string,
  context: DiscoverContext,
) {
  const city = await resolveCityRecord(citySlug);
  if (!city) return null;
  const [editorial, groups] = await Promise.all([
    resolvePublishedCity(city.slug),
    Promise.all(
      DISCOVER_PROVIDERS.filter((provider) => provider.key !== "cities").map(
        async (provider) => ({
          key: provider.key,
          label: provider.label,
          description: provider.description,
          items: await provider.search(context, { cityId: city.id, limit: 8 }),
        }),
      ),
    ),
  ]);
  return {
    city: {
      ...city,
      nativeName: chinaCityNativeName(city.id, city.name),
    },
    editorial: editorial ?? null,
    groups: groups.filter((group) => group.items.length > 0),
  };
}
