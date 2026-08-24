"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpen, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KONDO_CONTROL_CLASS } from "@/components/ui/Form";

/**
 * Putting a book into a deployed Kondo.
 *
 * Two paths, because they answer different questions. The sample book proves
 * the reader works in this environment and needs nothing from the operator.
 * The upload is how a real licensed title arrives.
 *
 * Rights default to off. A licence that permits reading may still forbid
 * machine processing, so AI assistance is opt-in per title rather than assumed
 * from the fact that someone had the file.
 */
export function StudyBookImportForm() {
  const router = useRouter();
  const [pending, setPending] = useState<"sample" | "upload" | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function send(body: FormData, kind: "sample" | "upload") {
    setPending(kind);
    setError("");
    setDone("");
    try {
      const response = await fetch("/api/admin/study-books", {
        method: "POST",
        credentials: "include",
        body,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "That book could not be imported.");
      }
      setDone(
        `${payload.book.slug} imported — ${payload.book.status.toLowerCase()}, ${payload.book.bytes} bytes.`,
      );
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "That book could not be imported.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-black">
          <BookOpen aria-hidden="true" className="h-4 w-4 text-kondo-green" />
          Add Kondo&apos;s sample book
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Kondo&apos;s own writing, generated here rather than uploaded. A real
          EPUB with a real container and spine, free and published, so you can
          confirm the reader works in this environment without needing a
          licensed file first.
        </p>
        <Button
          className="mt-4"
          disabled={pending !== null}
          onClick={() => {
            const body = new FormData();
            body.set("sample", "true");
            void send(body, "sample");
          }}
          variant="secondary"
        >
          {pending === "sample" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              Importing…
            </>
          ) : (
            "Add the sample book"
          )}
        </Button>
      </Card>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-black">
          <Upload aria-hidden="true" className="h-4 w-4 text-kondo-green" />
          Import an EPUB
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Only a title Kondo has the right to distribute: a public-domain work,
          an openly licensed one, or one a publisher has licensed to you.
        </p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send(new FormData(event.currentTarget), "upload");
          }}
        >
          <label className="sm:col-span-2">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
              EPUB file
            </span>
            <input
              accept=".epub,application/epub+zip"
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-muted file:px-4 file:py-2 file:text-sm file:font-bold"
              name="file"
              required
              type="file"
            />
          </label>
          <label>
            <span className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
              Title
            </span>
            <input className={`${KONDO_CONTROL_CLASS} mt-1`} name="title" required />
          </label>
          <label>
            <span className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
              Author
            </span>
            <input className={`${KONDO_CONTROL_CLASS} mt-1`} name="author" />
          </label>
          <label>
            <span className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
              Address
            </span>
            <input
              className={`${KONDO_CONTROL_CLASS} mt-1`}
              name="slug"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="alice-in-wonderland"
              required
            />
          </label>
          <label>
            <span className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
              Price in cents (0 = free)
            </span>
            <input
              className={`${KONDO_CONTROL_CLASS} mt-1`}
              defaultValue="0"
              min="0"
              name="priceMinor"
              type="number"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
            <input name="aiAllowed" type="checkbox" value="true" />
            Allow Ask Kondo AI on this title
          </label>
          <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
            <input defaultChecked name="publish" type="checkbox" value="true" />
            Publish immediately
          </label>
          <div className="sm:col-span-2">
            <Button disabled={pending !== null} type="submit">
              {pending === "upload" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                  Importing…
                </>
              ) : (
                "Import book"
              )}
            </Button>
          </div>
        </form>
      </Card>

      {error ? (
        <p className="text-sm font-bold text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="text-sm font-bold text-kondo-green" role="status">
          {done}
        </p>
      ) : null}
    </div>
  );
}
