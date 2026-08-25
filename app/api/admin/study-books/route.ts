import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { hasTrustedOrigin } from "@/lib/request";
import {
  importAdminBook,
  importSampleBook,
  listAdminBooks,
  StudyBookError,
} from "@/lib/study-books-admin";

/**
 * Books are uploaded as multipart rather than posted as JSON: an EPUB is a
 * binary file, and base64 in a JSON body would inflate it by a third for no
 * benefit.
 */
export const dynamic = "force-dynamic";
// Reading the whole file into memory is what the importer needs anyway, and
// the service refuses anything over 25 MB before it reaches storage.
export const maxDuration = 60;

export async function GET() {
  const auth = await authorizeAdminApi("STUDENT_HUB_CONFIG_VIEW");
  if (!auth.authorized) return auth.error;
  try {
    return adminJson({ books: await listAdminBooks() });
  } catch (error) {
    return adminInternalError("admin.study-books.list", error);
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdminApi("STUDENT_HUB_CONFIG_MANAGE");
  if (!auth.authorized) return auth.error;

  try {
    const form = await request.formData().catch(() => null);
    if (!form)
      return adminJson({ error: "Send the book as a file." }, { status: 400 });

    // The sample book needs no upload: it is generated here.
    if (form.get("sample") === "true") {
      return adminJson(
        { book: await importSampleBook(auth.user.id) },
        { status: 201 },
      );
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return adminJson({ error: "Choose an .epub file." }, { status: 400 });
    }
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const price = Number(text("priceMinor") || "0");
    if (!Number.isFinite(price) || price < 0) {
      return adminJson(
        { error: "That price is not a number." },
        { status: 400 },
      );
    }

    const book = await importAdminBook({
      actorId: auth.user.id,
      bytes: new Uint8Array(await file.arrayBuffer()),
      fileName: file.name,
      slug: text("slug"),
      title: text("title"),
      author: text("author") || null,
      priceMinor: Math.round(price),
      aiAllowed: form.get("aiAllowed") === "true",
      publish: form.get("publish") === "true",
      language: text("language") || "en",
    });
    return adminJson({ book }, { status: 201 });
  } catch (error) {
    if (error instanceof StudyBookError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.study-books.import", error);
  }
}
