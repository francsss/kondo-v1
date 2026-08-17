import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BookReader } from "@/components/features/student-hub/BookReader";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { checkEntitlement } from "@/lib/study-entitlements";

export const metadata: Metadata = { title: "Reading — Student Hub" };
export const dynamic = "force-dynamic";

/**
 * The reader page.
 *
 * Authorization is decided here, on the server, before the reader component
 * exists — a member without an entitlement is sent back to the store rather
 * than shown a reader that will fail its own fetch. The client still cannot
 * skip this: every API the reader calls checks the entitlement again.
 */
export default async function BookReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ at?: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const { at } = await searchParams;

  const essential = await prisma.studyEssential.findUnique({
    where: { slug },
    select: { id: true, title: true, aiAllowed: true, deliveryType: true },
  });
  if (!essential) notFound();
  if (essential.deliveryType !== "EPUB") notFound();

  const entitlement = await checkEntitlement({
    userId: user.id,
    essentialId: essential.id,
  });
  if (!entitlement.allowed) redirect("/student-hub/books");

  return (
    <BookReader
      aiAllowed={essential.aiAllowed}
      /*
       * `?at=` is how every other surface links back into the book: a note,
       * a bookmark, and the way back from Ask AI all carry the locator they
       * belong to. Without it those links would open the reader at whatever
       * position was last saved, which is almost never the passage the member
       * just tapped. It is only ever a locator — the entitlement above is what
       * decides whether the book opens at all.
       */
      initialLocator={at?.slice(0, 600) || null}
      slug={slug}
      title={essential.title}
    />
  );
}
