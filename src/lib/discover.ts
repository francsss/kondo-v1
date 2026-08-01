import {
  DISCOVER_PROVIDERS,
  discoverProvider,
} from "@/features/discover/registry";
import type {
  DiscoverContext,
  DiscoverFilters,
  DiscoverResourceType,
} from "@/features/discover/types";

export async function discoverResources(input: {
  context: DiscoverContext;
  type?: DiscoverResourceType;
  filters?: DiscoverFilters;
}) {
  const filters = input.filters ?? {};
  const providers = input.type
    ? [discoverProvider(input.type)]
    : DISCOVER_PROVIDERS;
  const groups = await Promise.all(
    providers.map(async (provider) => ({
      key: provider.key,
      label: provider.label,
      description: provider.description,
      cacheTags: provider.cacheTags,
      items: await provider.search(input.context, {
        ...filters,
        limit: input.type
          ? Math.min(24, filters.limit ?? 24)
          : Math.min(6, filters.limit ?? 6),
      }),
    })),
  );
  return groups.filter((group) => input.type || group.items.length > 0);
}
