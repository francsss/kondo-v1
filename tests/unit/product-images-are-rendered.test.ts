import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Every surface that sells something has to show the picture.
 *
 * Two separate ways the photo went missing, neither of which errored:
 *
 * A query took the first image row without checking there was an asset behind
 * it that could actually be served. An abandoned upload leaves a row with a
 * null `mediaId`, or one pointing at an asset still `PENDING`, and `take: 1`
 * handed that row back while the real photo sat behind it. The card then drew
 * either a placeholder or an `<img>` whose request 404s — a blank square. The
 * fix is one selector, `listingImagesSelect`, that filters on exactly what the
 * media route will serve, so the query and the route cannot disagree.
 *
 * And Food & Services drew a card with no image in it at all. Nothing was
 * broken; the picture was simply never asked for. That surface is on the
 * shared `CatalogCard` now, which is where the organization storefront and
 * Discover already were.
 */

const read = (path: string) => readFileSync(resolve(path), "utf8");

/** Files that legitimately read listing images without the shared selector. */
const EXEMPT = new Set([
  // Moderation evidence: a report must capture what was published, including
  // an asset that has since been flagged or withdrawn.
  "src/lib/marketplace.ts:createOrReuseListingReport",
  // The admin console reviews every row, dead ones included — that is the job.
  "src/lib/marketplace.ts:getAdminListing",
]);

describe("listing queries select images that can actually be drawn", () => {
  const sources = [
    "src/lib/platform-queries.ts",
    "src/lib/marketplace.ts",
    "src/features/discover/registry.ts",
    "app/(platform)/marketplace/page.tsx",
    "app/(platform)/marketplace/[slug]/page.tsx",
    "app/api/marketplace/route.ts",
  ];

  it.each(sources)("%s uses listingImagesSelect", (path) => {
    expect(read(path)).toContain("listingImagesSelect");
  });

  it("leaves no query taking the first image row unfiltered", () => {
    // `take: 1` before the filter is the shape that produced the bug.
    for (const path of sources) {
      const source = read(path);
      expect(source).not.toMatch(
        /images:\s*\{\s*orderBy:\s*\{\s*order:\s*"asc"\s*\}\s*,\s*take:\s*1\s*[,}]/,
      );
    }
    expect(EXEMPT.size).toBeGreaterThan(0);
  });

  it("filters on the same condition the media route enforces", () => {
    const visibility = read("src/lib/content-visibility.ts");
    const media = read("src/lib/media.ts");
    expect(visibility).toContain("deliverableMediaWhere");
    // `getMediaForDelivery` refuses anything that is not both of these.
    expect(visibility).toMatch(/status:\s*"ACTIVE"/);
    expect(visibility).toMatch(/scanStatus:\s*"CLEAN"/);
    expect(media).toContain('asset.status !== "ACTIVE"');
    expect(media).toContain('asset.scanStatus !== "CLEAN"');
  });
});

describe("browse surfaces draw the picture", () => {
  it("Food & Services renders items on the shared commerce card", () => {
    const board = read(
      "src/components/features/marketplace/FoodAndServicesBoard.tsx",
    );
    expect(board).toContain("CatalogCard");
    // The bespoke card it used to draw had no image node at all.
    expect(board).not.toContain("<article");
  });

  it("the shared catalogue card actually references the media", () => {
    const card = read("src/components/features/catalog/CatalogCard.tsx");
    expect(card).toContain("item.media[0]");
    expect(card).toContain("src={item.media[0].url}");
  });

  it("no catalogue surface lists items without going through the card", () => {
    /*
     * A surface that maps `PublicCatalogItem` and never mentions media or the
     * shared card is the shape Food & Services had: a list of products with
     * the photo left out.
     */
    const roots = ["src/components/features", "app/(platform)"];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(resolve(dir), { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(path);
          continue;
        }
        if (!entry.name.endsWith(".tsx")) continue;
        const source = readFileSync(resolve(path), "utf8");
        if (!source.includes("PublicCatalogItem")) continue;
        const draws =
          source.includes("CatalogCard") ||
          source.includes("media[0]") ||
          source.includes("item.media");
        if (!draws) offenders.push(path);
      }
    };
    roots.forEach(walk);
    expect(offenders).toEqual([]);
  });
});
