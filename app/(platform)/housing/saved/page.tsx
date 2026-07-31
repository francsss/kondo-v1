import type { Metadata } from "next";
import { Bookmark } from "lucide-react";
import { HousingListingCard } from "@/components/features/housing/HousingListingCard";
import { HousingNav } from "@/components/features/housing/HousingNav";
import { Card } from "@/components/ui/Card";
import { listSavedHousing } from "@/lib/housing-saved";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Saved Housing" };

export default async function SavedHousingPage() {
  const user = await requireUser();
  const rows = await listSavedHousing(user.id);
  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <HousingNav active="/housing/saved" />
      <h1 className="mb-6 mt-7 font-display text-3xl font-black sm:text-4xl">
        Saved homes
      </h1>
      {rows.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ listing }) => (
            <HousingListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <Card className="py-14 text-center">
          <Bookmark className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 font-display text-xl font-black">
            No saved homes yet
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Save promising places and compare them here.
          </p>
        </Card>
      )}
    </main>
  );
}
