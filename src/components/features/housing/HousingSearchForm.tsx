import { Search } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function HousingSearchForm({
  cities,
  universities = [],
  defaults = {},
  compact = false,
}: {
  cities: Array<{ id: string; name: string }>;
  universities?: Array<{ id: string; name: string }>;
  defaults?: Record<string, string | undefined>;
  compact?: boolean;
}) {
  return (
    <form
      action="/housing/search"
      className={
        compact
          ? "grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto]"
          : "grid gap-3 rounded-3xl border border-border bg-card p-4 shadow-sm md:grid-cols-2 xl:grid-cols-6"
      }
      method="get"
    >
      {defaults.organizationId ? (
        <input
          name="organizationId"
          type="hidden"
          value={defaults.organizationId}
        />
      ) : null}
      <label className={compact ? "" : "xl:col-span-2"}>
        <span className="sr-only">Search Housing</span>
        <span className="relative block">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            className="h-12 w-full rounded-2xl border border-border bg-background pl-11 pr-4 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-ring/20"
            defaultValue={defaults.q}
            name="q"
            placeholder="City, district, university…"
            type="search"
          />
        </span>
      </label>
      <label>
        <span className="sr-only">City</span>
        <select
          className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring/20"
          defaultValue={defaults.cityId ?? ""}
          name="cityId"
        >
          <option value="">All cities</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </label>
      {compact ? null : (
        <>
          <label>
            <span className="sr-only">University</span>
            <select
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring/20"
              defaultValue={defaults.universityId ?? ""}
              name="universityId"
            >
              <option value="">Any university</option>
              {universities.map((university) => (
                <option key={university.id} value={university.id}>
                  {university.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Housing type</span>
            <select
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring/20"
              defaultValue={defaults.types ?? ""}
              name="types"
            >
              <option value="">Any home</option>
              <option value="ENTIRE_APARTMENT">Entire apartment</option>
              <option value="PRIVATE_ROOM">Private room</option>
              <option value="SHARED_ROOM">Shared room</option>
              <option value="STUDENT_RESIDENCE">Student residence</option>
              <option value="STUDIO">Studio</option>
              <option value="SUBLET">Sublet</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Minimum monthly rent in CNY</span>
            <input
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              defaultValue={defaults.minRent ?? ""}
              min="0"
              name="minRent"
              placeholder="Min rent (CNY)"
              step="100"
              type="number"
            />
          </label>
          <label>
            <span className="sr-only">Maximum monthly rent in CNY</span>
            <input
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              defaultValue={defaults.maxRent ?? ""}
              min="0"
              name="maxRent"
              placeholder="Max rent (CNY)"
              step="100"
              type="number"
            />
          </label>
          <label>
            <span className="sr-only">Minimum bedrooms</span>
            <input
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              defaultValue={defaults.bedrooms ?? ""}
              min="0"
              name="bedrooms"
              placeholder="Min bedrooms"
              type="number"
            />
          </label>
          <label>
            <span className="sr-only">Needed by date</span>
            <input
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              defaultValue={defaults.availableFrom ?? ""}
              name="availableFrom"
              title="Needed by date"
              type="date"
            />
          </label>
          <label>
            <span className="sr-only">Minimum stay in months</span>
            <input
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              defaultValue={defaults.minimumStayMonths ?? ""}
              min="1"
              name="minimumStayMonths"
              placeholder="Stay (months)"
              type="number"
            />
          </label>
          <label>
            <span className="sr-only">Furnishing</span>
            <select
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring/20"
              defaultValue={defaults.furnished ?? ""}
              name="furnished"
            >
              <option value="">Any furnishing</option>
              <option value="true">Furnished or partly furnished</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Publisher type</span>
            <select
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring/20"
              defaultValue={defaults.publisher ?? "ALL"}
              name="publisher"
            >
              <option value="ALL">Any publisher</option>
              <option value="VERIFIED_ORGANIZATION">
                Verified organizations
              </option>
              <option value="ORGANIZATION">Organizations</option>
              <option value="PERSONAL">Kondo members</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Essential amenity</span>
            <select
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring/20"
              defaultValue={defaults.amenities ?? ""}
              name="amenities"
            >
              <option value="">Any amenity</option>
              <option value="WIFI">Wi-Fi</option>
              <option value="AIR_CONDITIONING">Air conditioning</option>
              <option value="WASHING_MACHINE">Washing machine</option>
              <option value="KITCHEN">Kitchen</option>
              <option value="PRIVATE_BATHROOM">Private bathroom</option>
              <option value="PUBLIC_TRANSPORT">Public transport</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Pet policy</span>
            <select
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring/20"
              defaultValue={defaults.petPolicy ?? ""}
              name="petPolicy"
            >
              <option value="">Any pet policy</option>
              <option value="ALLOWED">Pets allowed</option>
              <option value="NOT_ALLOWED">No pets</option>
              <option value="CASE_BY_CASE">Ask about pets</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Smoking policy</span>
            <select
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring/20"
              defaultValue={defaults.smokingPolicy ?? ""}
              name="smokingPolicy"
            >
              <option value="">Any smoking policy</option>
              <option value="NOT_ALLOWED">Non-smoking</option>
              <option value="ALLOWED">Smoking allowed</option>
              <option value="CASE_BY_CASE">Ask the publisher</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Sort results</span>
            <select
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring/20"
              defaultValue={defaults.sort ?? "RELEVANCE"}
              name="sort"
            >
              <option value="RELEVANCE">Recommended</option>
              <option value="NEWEST">Newest</option>
              <option value="PRICE_ASC">Lowest price</option>
              <option value="PRICE_DESC">Highest price</option>
              <option value="AVAILABLE">Available first</option>
            </select>
          </label>
        </>
      )}
      <Button className={compact ? "h-12" : "h-12"} type="submit">
        Search
      </Button>
    </form>
  );
}
