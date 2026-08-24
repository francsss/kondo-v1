import { redirect } from "next/navigation";

/**
 * Folded into My Library.
 *
 * "Digital Books" and "Purchased Materials" were the same acquisitions filtered
 * two ways, and the digital shelf could never show an EPUB because it required
 * chapter rows. Both are sections of one library now. The routes stay so that
 * bookmarks, and any link already sent to a student, still land somewhere.
 */
export default function BooksPage() {
  redirect("/student-hub/essentials/library");
}
