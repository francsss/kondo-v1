import type { Metadata } from "next";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { StudyBookImportForm } from "@/components/features/admin/StudyBookImportForm";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireAdminPermission } from "@/lib/server-auth";
import { listAdminBooks } from "@/lib/study-books-admin";

export const metadata: Metadata = { title: "Digital books — Admin" };
export const dynamic = "force-dynamic";

/**
 * Where a book comes from on a deployed Kondo.
 *
 * Seeding never runs in production, and the importer was a command-line
 * script, so until now a deployed environment had no way to create a readable
 * title — the reader existed with nothing it could ever open.
 */
export default async function AdminStudyBooksPage() {
  const user = await requireAdminPermission("STUDENT_HUB_CONFIG_VIEW");
  const books = await listAdminBooks();

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-7 sm:px-6 lg:px-8">
      <AdminNav currentPath="/admin/study-books" role={user.role} />
      <div className="mt-6">
        <PageHeader
          description="EPUB titles students can open in the Kondo reader."
          eyebrow="Admin"
          title="Digital books"
        />
      </div>

      <div className="mt-7">
        <StudyBookImportForm />
      </div>

      <section className="mt-9">
        <h2 className="text-lg font-black tracking-[-0.02em]">
          In the catalogue
        </h2>
        {books.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">Address</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Price</th>
                  <th className="py-2 pr-4">AI</th>
                  <th className="py-2">Size</th>
                </tr>
              </thead>
              <tbody>
                {books.map((book) => (
                  <tr className="border-b border-border/60" key={book.id}>
                    <td className="py-2 pr-4 font-bold">
                      {book.title}
                      {book.author ? (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {book.author}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{book.slug}</td>
                    <td className="py-2 pr-4">{book.status}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {book.priceMinor
                        ? `${(book.priceMinor / 100).toFixed(2)} ${book.currency}`
                        : "Free"}
                    </td>
                    <td className="py-2 pr-4">
                      {book.aiAllowed ? "Yes" : "No"}
                    </td>
                    <td className="py-2 tabular-nums">
                      {book.assetBytes
                        ? `${Math.round(book.assetBytes / 1024)} KB`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Card className="mt-3 py-10 text-center">
            <p className="font-black">No digital books yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Add the sample book above to confirm the reader works here, or
              import a title you have the right to distribute.
            </p>
          </Card>
        )}
      </section>
    </div>
  );
}
