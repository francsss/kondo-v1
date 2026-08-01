import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { CatalogCard } from "@/components/features/catalog/CatalogCard";
import {
  listSavedCatalog,
  type PublicCatalogItem,
} from "@/lib/organization-catalog";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Saved products and services" };
export const dynamic = "force-dynamic";

export default async function SavedCatalogPage() {
  const user = await requireUser();
  const saved = await listSavedCatalog(user.id);
  const total = saved.products.length + saved.services.length;

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Link className="text-sm font-black text-kondo-green" href="/discover">
        ← Discover
      </Link>
      <div className="mt-6 flex items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
          <Bookmark className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-kondo-green">
            Your private collection
          </p>
          <h1 className="text-3xl font-black tracking-tight">Saved catalog</h1>
        </div>
      </div>

      {total ? (
        <div className="mt-8 space-y-10">
          {saved.products.length ? (
            <CatalogGroup items={saved.products} title="Products" />
          ) : null}
          {saved.services.length ? (
            <CatalogGroup items={saved.services} title="Services" />
          ) : null}
        </div>
      ) : (
        <section className="mt-8 rounded-4xl border border-dashed border-border p-12 text-center">
          <h2 className="text-xl font-black">Nothing saved yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Products and services you save appear here only while they remain
            publicly available.
          </p>
          <Link
            className="mt-5 inline-flex rounded-full bg-kondo-green px-5 py-3 text-sm font-black text-white"
            href="/discover"
          >
            Explore Kondo
          </Link>
        </section>
      )}
    </div>
  );
}

function CatalogGroup({
  title,
  items,
}: {
  title: string;
  items: PublicCatalogItem[];
}) {
  return (
    <section>
      <h2 className="text-2xl font-black tracking-tight">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <CatalogCard item={item} key={`${item.kind}:${item.id}`} />
        ))}
      </div>
    </section>
  );
}
