import type { Metadata } from "next";
import { OpportunityAccountNav } from "@/components/features/opportunities/OpportunityAccountNav";
import { OpportunityDocumentVault } from "@/components/features/opportunities/OpportunityDocumentVault";
import { listUserOpportunityDocuments } from "@/lib/opportunity-documents";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Opportunity documents" };
export const dynamic = "force-dynamic";

export default async function OpportunityDocumentsPage() {
  const user = await requireUser();
  const documents = await listUserOpportunityDocuments(user.id);
  return (
    <div className="mx-auto max-w-[900px] px-4 pb-20 pt-8 sm:px-6 lg:pt-12">
      <h1 className="text-3xl font-black tracking-[-0.04em]">My documents</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A private, reusable vault for opportunity applications.
      </p>
      <OpportunityAccountNav />
      <OpportunityDocumentVault initialDocuments={documents} />
    </div>
  );
}
