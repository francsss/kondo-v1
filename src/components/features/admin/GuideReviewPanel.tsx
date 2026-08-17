"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KONDO_CONTROL_CLASS } from "@/components/ui/Form";

/**
 * Where an editor records what Kondo actually knows about a guide.
 *
 * The content pack that seeded the Guide could not be verified by its author,
 * so every guide arrived as NEEDS_REVIEW with sources listed as leads. Without
 * this panel they would stay that way permanently — the columns existed and
 * nothing could write to them.
 *
 * The order on screen is the order of the work: read the sources, then say
 * what you found. Verification sits last and is disabled until a source
 * exists, because vouching for a guide nobody can check is the failure this
 * whole system was built to prevent.
 */

type Source = {
  id: string;
  title: string;
  url: string;
  organization: string | null;
  isOfficial: boolean;
};

const STATUSES = [
  ["DRAFT", "Draft", "Not visible to students."],
  ["NEEDS_REVIEW", "Needs review", "Visible, and says it is unreviewed."],
  ["VERIFIED", "Verified", "Kondo has checked this against its sources."],
  ["ARCHIVED", "Archived", "Withdrawn from search and lists."],
] as const;

export function GuideReviewPanel({
  guideId,
  initial,
  canVerify,
}: {
  guideId: string;
  initial: {
    contentStatus: string;
    lastVerifiedAt: string | null;
    reviewDueAt: string | null;
    sources: Source[];
  };
  /** Whether this admin holds the review permission, not merely CMS access. */
  canVerify: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial.contentStatus);
  const initialReviewDue = initial.reviewDueAt
    ? initial.reviewDueAt.slice(0, 10)
    : "";
  const [reviewDue, setReviewDue] = useState(initialReviewDue);
  // What the server currently holds, so "Save date" is dead until it differs.
  const [savedReviewDue, setSavedReviewDue] = useState(initialReviewDue);
  const [sources, setSources] = useState<Source[]>(initial.sources);
  const [verifiedAt, setVerifiedAt] = useState(initial.lastVerifiedAt);
  const [draft, setDraft] = useState({
    title: "",
    url: "",
    organization: "",
    isOfficial: true,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  async function save(next?: string) {
    setPending(true);
    setError("");
    setSaved("");
    try {
      const response = await fetch(`/api/admin/guides/${guideId}/review`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(next ? { status: next } : {}),
          reviewDueAt: reviewDue
            ? new Date(`${reviewDue}T00:00:00Z`).toISOString()
            : null,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Could not save.");
      if (next) setStatus(next);
      setVerifiedAt(body?.guide?.lastVerifiedAt ?? null);
      setSavedReviewDue(reviewDue);
      setSaved(
        next === "VERIFIED"
          ? "Marked verified, stamped with today's date and your name."
          : "Saved.",
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  async function addSource() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/guides/${guideId}/review`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          url: draft.url,
          organization: draft.organization || null,
          isOfficial: draft.isOfficial,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Could not add source.");
      setSources((current) => [...current, body.source]);
      setDraft({ title: "", url: "", organization: "", isOfficial: true });
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not add source.",
      );
    } finally {
      setPending(false);
    }
  }

  async function removeSource(sourceId: string) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/guides/sources/${sourceId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Could not remove.");
      setSources((current) =>
        current.filter((source) => source.id !== sourceId),
      );
      // Removing the last source withdraws a verified claim server-side.
      if (body?.demoted) {
        setStatus("NEEDS_REVIEW");
        setVerifiedAt(null);
        setSaved("Last source removed, so this went back to needing review.");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-black">Sources and review</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        What Kondo tells a student about this guide&rsquo;s standing.
      </p>

      <div className="mt-5">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
          Sources
        </p>
        {sources.length ? (
          <ul className="mt-2 space-y-2">
            {sources.map((source) => (
              <li
                className="flex items-start gap-3 rounded-2xl border border-border p-3"
                key={source.id}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {source.title}
                    {source.isOfficial ? (
                      <span className="ml-2 rounded-full bg-kondo-mint px-1.5 py-0.5 text-[10px] font-black text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
                        Official
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {source.organization ? `${source.organization} · ` : ""}
                    {source.url}
                  </span>
                </span>
                <button
                  aria-label={`Remove ${source.title}`}
                  className="shrink-0 rounded-full p-2 text-muted-foreground transition hover:text-destructive"
                  disabled={pending}
                  onClick={() => void removeSource(source.id)}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-2xl border border-dashed border-border p-3 text-sm text-muted-foreground">
            No sources yet. A guide cannot be marked verified without one.
          </p>
        )}

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            aria-label="Source title"
            className={KONDO_CONTROL_CLASS}
            onChange={(event) =>
              setDraft((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Source title"
            value={draft.title}
          />
          <input
            aria-label="Source URL"
            className={KONDO_CONTROL_CLASS}
            onChange={(event) =>
              setDraft((current) => ({ ...current, url: event.target.value }))
            }
            placeholder="https://…"
            value={draft.url}
          />
          <input
            aria-label="Publishing organisation"
            className={KONDO_CONTROL_CLASS}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                organization: event.target.value,
              }))
            }
            placeholder="Publishing organisation"
            value={draft.organization}
          />
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              checked={draft.isOfficial}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  isOfficial: event.target.checked,
                }))
              }
              type="checkbox"
            />
            Official primary source
          </label>
        </div>
        <Button
          className="mt-3"
          disabled={pending || !draft.title.trim() || !draft.url.trim()}
          onClick={() => void addSource()}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Plus className="h-4 w-4" /> Add source
        </Button>
      </div>

      <div className="mt-7 border-t border-border pt-5">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
          Review
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-sm font-bold">
            Review again by
            <input
              className={`${KONDO_CONTROL_CLASS} mt-2`}
              onChange={(event) => setReviewDue(event.target.value)}
              type="date"
              value={reviewDue}
            />
          </label>
          {/* Its own action, so the date can move without re-asserting a status. */}
          <Button
            disabled={pending || reviewDue === savedReviewDue}
            onClick={() => void save()}
            size="sm"
            type="button"
            variant="secondary"
          >
            Save date
          </Button>
        </div>
        {verifiedAt ? (
          <p className="mt-2 text-xs font-bold text-muted-foreground">
            Last verified{" "}
            {new Date(verifiedAt).toLocaleDateString("en", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        ) : null}

        <div className="mt-4 grid gap-2">
          {STATUSES.map(([value, label, description]) => {
            const isVerify = value === "VERIFIED";
            const blocked = isVerify && (!canVerify || sources.length === 0);
            return (
              <button
                aria-pressed={status === value}
                className={`rounded-2xl border p-3 text-left transition disabled:opacity-50 ${
                  status === value
                    ? "border-kondo-green bg-kondo-mint dark:bg-emerald-400/10"
                    : "border-border hover:border-kondo-green/40"
                }`}
                disabled={pending || blocked}
                key={value}
                onClick={() => void save(value)}
                type="button"
              >
                <span className="block text-sm font-black">{label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {blocked
                    ? !canVerify
                      ? "Requires the guide review permission."
                      : "Add a source first."
                    : description}
                </span>
              </button>
            );
          })}
        </div>

        {pending ? (
          <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
            Saving…
          </p>
        ) : null}
        {saved ? (
          <p className="mt-3 text-xs font-bold text-kondo-green">{saved}</p>
        ) : null}
        {error ? (
          <p className="mt-3 text-xs font-bold text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
