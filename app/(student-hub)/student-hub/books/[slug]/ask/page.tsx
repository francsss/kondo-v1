import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AskBookAi } from "@/components/features/student-hub/AskBookAi";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { checkEntitlement } from "@/lib/study-entitlements";

export const metadata: Metadata = { title: "Ask Kondo AI" };
export const dynamic = "force-dynamic";

/**
 * The Ask AI surface, gated the same way the reader is.
 *
 * The passage arrives in the query string because it is a selection the reader
 * just made in an iframe, not something the server can look up. That is safe:
 * it is only ever used as the text to ask about, and the answer still requires
 * an entitlement and the title's `aiAllowed` flag on the API side.
 */
export default async function AskBookAiPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ text?: string; cfi?: string; chapter?: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const query = await searchParams;

  const essential = await prisma.studyEssential.findUnique({
    where: { slug },
    select: { id: true, aiAllowed: true },
  });
  if (!essential) notFound();

  const entitlement = await checkEntitlement({
    userId: user.id,
    essentialId: essential.id,
  });
  if (!entitlement.allowed) redirect("/student-hub/books");
  // A licence that forbids machine processing forbids this page too, not just
  // the button that leads to it.
  if (!essential.aiAllowed) redirect(`/student-hub/books/${slug}`);

  const selectedText = (query.text ?? "").slice(0, 1200).trim();
  if (!selectedText) redirect(`/student-hub/books/${slug}`);

  return (
    <AskBookAi
      cfi={query.cfi ?? null}
      chapter={query.chapter ?? null}
      selectedText={selectedText}
      slug={slug}
    />
  );
}
