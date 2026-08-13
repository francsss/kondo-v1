"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Link2, Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";

/**
 * The resources this course actually uses.
 *
 * Workspace does not hold a library — My Library does. This lists only what the
 * student attached to *this* course, so a Physics screen shows Physics
 * Fundamentals rather than all five books they own, and every entry resumes
 * where reading stopped instead of restarting at chapter one.
 *
 * The picker's contents are fetched when it opens, never with the page.
 */

export type CourseMaterial = {
  linkId: string;
  id: string;
  slug: string;
  title: string;
  format: string;
  coverEmoji: string | null;
  chapterCount: number;
  progress: {
    lastReadAt: Date | string;
    chapter: { id: string; title: string; position: number } | null;
  } | null;
};

type Linkable = {
  id: string;
  slug: string;
  title: string;
  coverEmoji: string | null;
  format: string;
};

export function CourseMaterials({
  courseId,
  materials,
}: {
  courseId: string;
  materials: CourseMaterial[];
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [options, setOptions] = useState<Linkable[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function openPicker() {
    setPickerOpen(true);
    setError("");
    if (options) return;
    const response = await fetch(
      `/api/student-hub/workspace/resources?courseId=${courseId}`,
      { credentials: "include" },
    ).catch(() => null);
    if (!response?.ok) {
      setError("Your library could not be loaded.");
      setOptions([]);
      return;
    }
    const body = (await response.json()) as { resources: Linkable[] };
    setOptions(body.resources);
  }

  async function link(essentialId: string) {
    setBusy(essentialId);
    setError("");
    const response = await fetch("/api/student-hub/workspace/resources", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, essentialId }),
    }).catch(() => null);
    setBusy(null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(body?.error ?? "The resource was not linked.");
      return;
    }
    setOptions((current) =>
      (current ?? []).filter((option) => option.id !== essentialId),
    );
    setPickerOpen(false);
    router.refresh();
  }

  async function unlink(linkId: string) {
    setBusy(linkId);
    await fetch(`/api/student-hub/workspace/resources?linkId=${linkId}`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => null);
    setBusy(null);
    setOptions(null);
    router.refresh();
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          Materials
        </h2>
        <button
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-bold text-muted-foreground transition hover:border-kondo-green/40 hover:text-kondo-green"
          onClick={openPicker}
          type="button"
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          Add material
        </button>
      </div>

      {materials.length ? (
        <ul className="mt-3 space-y-2">
          {materials.map((material) => {
            const chapter = material.progress?.chapter;
            return (
              <li
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                key={material.linkId}
              >
                <span
                  aria-hidden="true"
                  className="grid h-11 w-9 shrink-0 place-items-center rounded-lg bg-muted text-lg"
                >
                  {material.coverEmoji ?? "📘"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-foreground">
                    {material.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {chapter
                      ? `Chapter ${chapter.position + 1} · ${chapter.title}`
                      : material.chapterCount
                        ? `${material.chapterCount} chapters`
                        : "Not started"}
                  </span>
                </span>
                {material.format === "DIGITAL" && material.chapterCount ? (
                  <Link
                    className="inline-flex min-h-9 shrink-0 items-center rounded-full bg-kondo-green px-3.5 text-xs font-black text-white"
                    href={`/student-hub/essentials/read/${material.slug}`}
                  >
                    {chapter ? "Continue" : "Read"}
                  </Link>
                ) : null}
                <button
                  aria-label={`Unlink ${material.title}`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                  disabled={busy === material.linkId}
                  onClick={() => unlink(material.linkId)}
                  type="button"
                >
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        // One short line. Three paragraphs of what you do not have is what an
        // empty course used to read as.
        <p className="mt-2 text-sm text-muted-foreground">
          Attach a book you read for this class.
        </p>
      )}

      <BottomSheet
        onClose={() => setPickerOpen(false)}
        open={pickerOpen}
        title="Add material"
      >
        {error ? (
          <p className="mb-3 text-xs font-bold text-destructive">{error}</p>
        ) : null}
        {options === null ? (
          <div className="space-y-2">
            {[0, 1, 2].map((row) => (
              <div
                className="h-14 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none"
                key={row}
              />
            ))}
          </div>
        ) : options.length ? (
          <ul className="space-y-2">
            {options.map((option) => (
              <li key={option.id}>
                <button
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-kondo-green/40 disabled:opacity-60"
                  disabled={busy === option.id}
                  onClick={() => link(option.id)}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className="grid h-10 w-8 shrink-0 place-items-center rounded-lg bg-muted text-base"
                  >
                    {option.coverEmoji ?? "📘"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
                    {option.title}
                  </span>
                  {busy === option.id ? (
                    <Loader2
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none"
                    />
                  ) : (
                    <Link2
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-kondo-green"
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-8 text-center">
            <BookOpen
              aria-hidden="true"
              className="mx-auto h-6 w-6 text-muted-foreground"
            />
            <p className="mt-3 text-sm font-bold text-foreground">
              Nothing left to link.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Everything you own is already attached to this course.
            </p>
            <Link
              className="mt-4 inline-flex min-h-10 items-center rounded-full border border-border px-4 text-sm font-bold"
              href="/student-hub/essentials"
            >
              Browse Study Essentials
            </Link>
          </div>
        )}
      </BottomSheet>
    </section>
  );
}
