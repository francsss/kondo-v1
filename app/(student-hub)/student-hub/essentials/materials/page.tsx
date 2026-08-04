import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";
import {
  LibraryShelf,
  ShelfHeader,
} from "@/components/features/student-hub/LibraryShelf";
import { requireUser } from "@/lib/server-auth";
import { listLibrary } from "@/lib/study-workspace";

export const metadata: Metadata = {
  title: "Purchased Materials — Study Essentials",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PurchasedMaterialsPage() {
  const user = await requireUser();
  const library = await listLibrary(user.id);
  // Everything that is not a readable title: planners, notebooks, kits, and
  // digital acquisitions whose content is not published yet.
  const materials = library.filter(
    (entry) =>
      entry.essential.format === "PHYSICAL" ||
      entry.essential._count.chapters === 0,
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <ShelfHeader
          description="Planners, notebooks and kits you have ordered. Delivery details are collected once real payments are enabled."
          title="Purchased Materials"
        />
        <Link
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border px-4 text-sm font-black transition hover:border-kondo-green hover:text-kondo-green"
          href="/student-hub/orders"
        >
          <Receipt aria-hidden="true" className="h-4 w-4" />
          Your orders
        </Link>
      </div>
      <LibraryShelf
        emptyBody="Physical materials you order appear here with the date you acquired them."
        emptyTitle="No materials yet"
        entries={materials}
      />
    </div>
  );
}
