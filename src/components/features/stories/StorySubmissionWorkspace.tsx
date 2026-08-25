"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileVideo2,
  ImagePlus,
  LoaderCircle,
  Send,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FocusedFormShell } from "@/components/ui/FocusedFormShell";
import { KONDO_CONTROL_CLASS } from "@/components/ui/Form";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { uploadMediaFile } from "@/lib/client-media";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

type Option = { id: string; name: string };
type PublishingOptions = {
  categories: Array<Option & { icon: string | null }>;
  cities: Option[];
  universities: Array<Option & { shortName: string | null }>;
  communities: Array<Option & { icon: string | null }>;
  canPublishDirectly: boolean;
};

type Submission = {
  id: string;
  slug: string;
  title: string;
  status: string;
  revision: number;
  moderationReason: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  posterMediaId: string | null;
  category: { name: string; icon: string | null };
};

type EditingStory = {
  id: string;
  title: string;
  description: string;
  language: string;
  captions: string | null;
  categoryId: string;
  moderationReason: string | null;
  entityLinks: Array<{
    type: string;
    cityId: string | null;
    universityId: string | null;
    communityId: string | null;
    externalEntityId: string | null;
    externalLabel: string | null;
    externalHref: string | null;
  }>;
} | null;

const draftKey = "kondo-story-submission-draft";

function readDraft() {
  if (typeof window === "undefined") return null;
  const draft = window.localStorage.getItem(draftKey);
  if (!draft) return null;
  try {
    return JSON.parse(draft) as Record<string, string>;
  } catch {
    return null;
  }
}

export function StorySubmissionWorkspace({
  options,
  submissions,
  editing,
}: {
  options: PublishingOptions;
  submissions: Submission[];
  editing: EditingStory;
}) {
  const router = useRouter();
  /*
   * The form lives inside the shell's content and the Publish button inside
   * its sticky footer, so the button reaches the form by id rather than by
   * being nested in it. That is what lets the action stay above the keyboard.
   */
  const formId = useId();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [poster, setPoster] = useState<File | null>(null);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");
  const [language, setLanguage] = useState(editing?.language ?? "en");
  const [captions, setCaptions] = useState(editing?.captions ?? "");
  const [cityId, setCityId] = useState(
    editing?.entityLinks.find((link) => link.type === "CITY")?.cityId ?? "",
  );
  const [universityId, setUniversityId] = useState(
    editing?.entityLinks.find((link) => link.type === "UNIVERSITY")
      ?.universityId ?? "",
  );
  const [communityId, setCommunityId] = useState(
    editing?.entityLinks.find((link) => link.type === "COMMUNITY")
      ?.communityId ?? "",
  );
  const editingExternal = editing?.entityLinks.find((link) =>
    ["COMPANY", "INTERNSHIP", "EVENT"].includes(link.type),
  );
  const [externalType, setExternalType] = useState(editingExternal?.type ?? "");
  const [externalLabel, setExternalLabel] = useState(
    editingExternal?.externalLabel ?? "",
  );
  const [externalHref, setExternalHref] = useState(
    editingExternal?.externalHref ?? "",
  );
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /*
   * A blob URL for the chosen clip, revoked when it is replaced or the page
   * goes away. Held in a memo rather than state so the preview never lags a
   * frame behind the file it belongs to.
   */
  const videoPreview = useMemo(
    () => (video ? URL.createObjectURL(video) : ""),
    [video],
  );
  useEffect(
    () => () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    },
    [videoPreview],
  );

  useEffect(() => {
    if (editing) return;
    const timer = window.setTimeout(() => {
      const draft = readDraft();
      if (!draft) return;
      setTitle(draft.title ?? "");
      setDescription(draft.description ?? "");
      setCategoryId(draft.categoryId ?? "");
      setLanguage(draft.language ?? "en");
      setCaptions(draft.captions ?? "");
      setCityId(draft.cityId ?? "");
      setUniversityId(draft.universityId ?? "");
      setCommunityId(draft.communityId ?? "");
      setExternalType(draft.externalType ?? "");
      setExternalLabel(draft.externalLabel ?? "");
      setExternalHref(draft.externalHref ?? "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editing]);

  useEffect(() => {
    if (editing) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({
          title,
          description,
          categoryId,
          language,
          captions,
          cityId,
          universityId,
          communityId,
          externalType,
          externalLabel,
          externalHref,
        }),
      );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    captions,
    categoryId,
    cityId,
    communityId,
    description,
    editing,
    externalHref,
    externalLabel,
    externalType,
    language,
    title,
    universityId,
  ]);

  function validateVideo(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    // Mirrors STORY_VIDEO in media-policy. This is a courtesy check that
    // fails fast in the picker; the server sniffs the actual bytes and is what
    // actually decides, because a file name proves nothing.
    const supportedExtensions = ["mp4", "mov", "m4v", "webm", "hevc", "h265"];
    const supportedMimeTypes = [
      "video/mp4",
      "video/quicktime",
      "video/x-m4v",
      "video/webm",
      "video/hevc",
      "video/h265",
    ];
    if (
      !supportedMimeTypes.includes(file.type.toLowerCase()) &&
      !supportedExtensions.includes(extension ?? "")
    ) {
      return "Choose a common video (MP4, MOV, M4V, WebM, HEVC or H.265).";
    }
    if (file.size > 25 * 1024 * 1024) {
      return "Videos must be 25 MB or smaller.";
    }
    return "";
  }

  async function checkDuration(file: File) {
    const url = URL.createObjectURL(file);
    try {
      const duration = await new Promise<number>((resolve, reject) => {
        const element = document.createElement("video");
        element.preload = "metadata";
        element.onloadedmetadata = () => resolve(element.duration);
        element.onerror = () =>
          reject(new Error("Video metadata unavailable."));
        element.src = url;
      });
      if (!Number.isFinite(duration) || duration <= 0 || duration > 180) {
        throw new Error("Student Stories must be 3 minutes or shorter.");
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function selectVideo(file?: File) {
    if (!file) return;
    const validation = validateVideo(file);
    if (validation) {
      setError(validation);
      return;
    }
    try {
      await checkDuration(file);
      setError("");
      setVideo(file);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Video could not be read.",
      );
    }
  }

  function selectPoster(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG or WebP poster.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Poster images must be 8 MB or smaller.");
      return;
    }
    setError("");
    setPoster(file);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!editing && !video) {
      setError("Choose a video before submitting.");
      return;
    }
    if (!confirmed) {
      setError("Confirm the privacy and rights checklist.");
      return;
    }
    if (
      externalType &&
      (!externalLabel.trim() ||
        !externalHref.startsWith("/") ||
        externalHref.startsWith("//"))
    ) {
      setError(
        "Add the Kondo name and internal page for the connected opportunity.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    setProgress(0);
    captureProductEvent(PRODUCT_EVENTS.PUBLISH_REQUEST_STARTED, {
      is_revision: Boolean(editing),
    });
    try {
      let videoMediaId: string | undefined;
      let posterMediaId: string | undefined;
      if (video) {
        setStage("Securely uploading your video…");
        videoMediaId = await uploadMediaFile(video, {
          purpose: "STORY_VIDEO",
          onProgress: (value) => setProgress(Math.round(value * 0.82)),
        });
      }
      if (poster) {
        setStage("Preparing the poster…");
        posterMediaId = await uploadMediaFile(poster, {
          purpose: "STORY_POSTER",
          altText: `Poster for ${title}`,
          onProgress: (value) => setProgress(82 + Math.round(value * 0.13)),
        });
      }
      setStage(
        editing ? "Resubmitting your changes…" : "Submitting for review…",
      );
      setProgress(97);
      const entityLinks = [
        cityId ? { type: "CITY", entityId: cityId } : null,
        universityId ? { type: "UNIVERSITY", entityId: universityId } : null,
        communityId ? { type: "COMMUNITY", entityId: communityId } : null,
        externalType
          ? {
              type: externalType,
              entityId:
                externalHref
                  .split("#")[0]
                  .split("?")[0]
                  .split("/")
                  .filter(Boolean)
                  .at(-1)
                  ?.slice(0, 160) ||
                externalLabel
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .slice(0, 160),
              label: externalLabel,
              href: externalHref,
            }
          : null,
      ].filter(Boolean);
      const body = {
        categoryId,
        ...(videoMediaId ? { videoMediaId } : {}),
        ...(posterMediaId ? { posterMediaId } : {}),
        title,
        description,
        language,
        captions: captions || null,
        entityLinks,
      };
      const response = await fetch(
        editing ? `/api/stories/${editing.id}` : "/api/stories",
        {
          method: editing ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Story could not be submitted.");
      }
      setProgress(100);
      setSuccess(
        options.canPublishDirectly && !editing
          ? "Your Story is now live."
          : editing
            ? "Your revised Story is back with the moderation team."
            : "Your Story was submitted for Kondo review.",
      );
      window.localStorage.removeItem(draftKey);
      captureProductEvent(
        editing
          ? PRODUCT_EVENTS.PUBLISH_REQUEST_RESUBMITTED
          : PRODUCT_EVENTS.PUBLISH_REQUEST_SUBMITTED,
        {
          story_id: payload?.story?.id ?? payload?.id,
          category_id: categoryId,
          direct_publish: options.canPublishDirectly,
        },
      );
      setVideo(null);
      setPoster(null);
      setConfirmed(false);
      /*
       * A reel that published goes straight to the feed, focused on itself.
       *
       * Staying on the form and refreshing it meant the student was told the
       * reel was live and then shown the empty form again, with no way to see
       * it except by navigating to Student Story and hoping. `refresh` first
       * so the feed the browser lands on is built after the insert rather than
       * from the copy cached before it.
       */
      router.refresh();
      const publishedSlug = payload?.story?.slug as string | undefined;
      if (!editing && publishedSlug && options.canPublishDirectly) {
        router.push(`/stories?story=${publishedSlug}&entry=publish`);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Story could not be submitted.",
      );
    } finally {
      setBusy(false);
      setStage("");
    }
  }
  return (
    <FocusedFormShell
      actions={
        <>
          <p className="min-w-0 flex-1 truncate text-[11px] leading-4 text-muted-foreground">
            {busy ? stage : "Draft saved on this device"}
          </p>
          <Button
            className="shrink-0"
            disabled={busy}
            form={formId}
            type="submit"
          >
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {editing ? "Resubmit" : "Publish reel"}
          </Button>
        </>
      }
      backHref="/stories"
      title={editing ? "Revise your reel" : "Create Reel"}
    >
      <form className="space-y-5" id={formId} onSubmit={submit}>
        {!editing ? (
          <section>
            {/*
             * The video, shown as the reel it will become.
             *
             * Picking a file used to change a line of text to its filename and
             * nothing else, so there was no way to tell whether the right clip
             * had been chosen, or which way up it was, until after publishing.
             * The frame is 9:16 and the video is contained inside it, so a
             * landscape clip letterboxes rather than stretching the page
             * sideways.
             */}
            <button
              className="relative block w-full overflow-hidden rounded-3xl border border-dashed border-kondo-green/40 bg-kondo-mint/30 transition hover:bg-kondo-mint/50 dark:bg-emerald-400/[0.06]"
              disabled={busy}
              onClick={() => videoInputRef.current?.click()}
              type="button"
            >
              {videoPreview ? (
                <span className="relative block aspect-[9/16] max-h-[46vh] w-full bg-black">
                  <video
                    className="h-full w-full object-contain"
                    muted
                    playsInline
                    // Metadata only: this is a thumbnail, not a viewing.
                    preload="metadata"
                    src={videoPreview}
                  />
                  <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/75 to-transparent p-3 text-left text-[11px] font-bold text-white">
                    <FileVideo2
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {video?.name}
                    </span>
                    <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 backdrop-blur">
                      Change
                    </span>
                  </span>
                </span>
              ) : (
                <span className="grid aspect-[4/3] w-full place-items-center px-6 py-8 text-center sm:aspect-[16/9]">
                  <span>
                    <FileVideo2
                      aria-hidden="true"
                      className="mx-auto h-7 w-7 text-kondo-green"
                    />
                    <span className="mt-3 block text-sm font-black">
                      Choose a video
                    </span>
                    <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                      MP4, MOV, M4V, WebM or HEVC · up to 3 minutes and 25 MB
                    </span>
                  </span>
                </span>
              )}
            </button>

            <button
              className="mt-2 flex w-full items-center gap-2 rounded-2xl border border-border px-3 py-2.5 text-left transition hover:border-kondo-green/40"
              disabled={busy}
              onClick={() => posterInputRef.current?.click()}
              type="button"
            >
              <ImagePlus
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-kondo-green"
              />
              <span className="min-w-0 flex-1 truncate text-xs font-bold">
                {poster ? poster.name : "Add a cover image"}
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                Optional
              </span>
            </button>

            <input
              accept="video/mp4,video/quicktime,video/x-m4v,video/webm,video/hevc,video/h265,.mp4,.mov,.m4v,.webm,.hevc,.h265"
              className="sr-only"
              onChange={(event) => void selectVideo(event.target.files?.[0])}
              ref={videoInputRef}
              type="file"
            />
            <input
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => selectPoster(event.target.files?.[0])}
              ref={posterInputRef}
              type="file"
            />
          </section>
        ) : null}

        {editing?.moderationReason ? (
          <p className="rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
            {editing.moderationReason}
          </p>
        ) : null}

        <Field label="Title">
          <input
            className={KONDO_CONTROL_CLASS}
            maxLength={120}
            minLength={4}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="One clear line"
            required
            value={title}
          />
        </Field>

        <SearchableSelect
          label="Category"
          onSelect={setCategoryId}
          options={options.categories.map((category) => ({
            id: category.id,
            name: `${category.icon} ${category.name}`,
          }))}
          placeholder="Choose a category"
          searchPlaceholder="Search categories"
          selected={categoryId}
        />

        <Field label="Caption">
          <textarea
            className={`${KONDO_CONTROL_CLASS} min-h-28 resize-y py-3 leading-6`}
            maxLength={700}
            minLength={10}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What should another student understand or do after watching?"
            required
            value={description}
          />
        </Field>

        {/*
         * Everything below is optional, and on a phone a form is judged by how
         * far it scrolls. Closed by default, so the page a student meets is
         * video, title, category, caption — and nothing else.
         */}
        <details className="group rounded-2xl border border-border">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-black">
            <ChevronRight
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-90 motion-reduce:transition-none"
            />
            Add context
            <span className="ml-auto font-semibold text-muted-foreground">
              Optional
            </span>
          </summary>
          <div className="space-y-4 border-t border-border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Language">
                <select
                  className={KONDO_CONTROL_CLASS}
                  onChange={(event) => setLanguage(event.target.value)}
                  value={language}
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="zh">中文</option>
                  <option value="ar">العربية</option>
                </select>
              </Field>
              <Field label="Captions or WebVTT">
                <input
                  className={KONDO_CONTROL_CLASS}
                  onChange={(event) => setCaptions(event.target.value)}
                  placeholder="Optional transcript"
                  value={captions}
                />
              </Field>
            </div>
            <ContextSelect
              label="City"
              onChange={setCityId}
              options={options.cities}
              value={cityId}
            />
            <ContextSelect
              label="University"
              onChange={setUniversityId}
              options={options.universities.map((item) => ({
                id: item.id,
                name: item.shortName ?? item.name,
              }))}
              value={universityId}
            />
            <ContextSelect
              label="Community"
              onChange={setCommunityId}
              options={options.communities}
              value={communityId}
            />
            <Field label="Related resource">
              <select
                className={KONDO_CONTROL_CLASS}
                onChange={(event) => setExternalType(event.target.value)}
                value={externalType}
              >
                <option value="">None</option>
                <option value="COMPANY">Company</option>
                <option value="INTERNSHIP">Internship</option>
                <option value="EVENT">Event</option>
              </select>
            </Field>
            {externalType ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Resource name">
                  <input
                    className={KONDO_CONTROL_CLASS}
                    maxLength={160}
                    onChange={(event) => setExternalLabel(event.target.value)}
                    placeholder="e.g. Welcome Week"
                    value={externalLabel}
                  />
                </Field>
                <Field label="Kondo page">
                  <input
                    className={KONDO_CONTROL_CLASS}
                    maxLength={500}
                    onChange={(event) => setExternalHref(event.target.value)}
                    placeholder="/explore/jiaxing/events"
                    value={externalHref}
                  />
                </Field>
              </div>
            ) : null}
          </div>
        </details>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-muted/30 p-3.5">
          <input
            checked={confirmed}
            className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-700"
            onChange={(event) => setConfirmed(event.target.checked)}
            type="checkbox"
          />
          <span className="text-[11px] leading-5 text-muted-foreground">
            I have the right to share this video. It does not reveal private
            documents, home addresses, personal numbers, confidential university
            data, or people who did not consent.
          </span>
        </label>

        {busy ? (
          <div className="rounded-2xl border border-kondo-green/20 bg-kondo-mint/50 p-3.5 dark:bg-emerald-400/10">
            <div className="flex items-center justify-between text-[11px] font-black text-kondo-forest dark:text-emerald-300">
              <span className="min-w-0 truncate">{stage}</span>
              <span className="shrink-0 tabular-nums">{progress}%</span>
            </div>
            <div
              aria-label="Story upload progress"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={progress}
              className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/80 dark:bg-black/20"
              role="progressbar"
            >
              <div
                className="h-full rounded-full bg-kondo-green transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}
        {error ? (
          <p
            aria-live="polite"
            className="flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300"
            role="alert"
          >
            <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}
        {success ? (
          <p
            aria-live="polite"
            className="flex items-start gap-2 rounded-2xl bg-kondo-mint p-3 text-xs font-semibold text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300"
          >
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
            {success}
          </p>
        ) : null}
      </form>

      {submissions.length ? (
        <section className="mt-8">
          <h2 className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
            Your reels
          </h2>
          <ul className="mt-3 space-y-2">
            {submissions.map((submission) => (
              <li
                className="rounded-2xl border border-border p-3"
                key={submission.id}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">
                      {submission.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {submission.category.icon} {submission.category.name}
                    </p>
                  </div>
                  <StatusBadge status={submission.status} />
                </div>
                {submission.moderationReason ? (
                  <p className="mt-2 text-[11px] leading-4 text-amber-700 dark:text-amber-300">
                    {submission.moderationReason}
                  </p>
                ) : null}
                <div className="mt-2">
                  {submission.status === "CHANGES_REQUESTED" ? (
                    <Link
                      className="text-[11px] font-black text-kondo-green hover:underline"
                      href={`/stories/submit?story=${submission.id}`}
                    >
                      Revise submission →
                    </Link>
                  ) : submission.status === "PUBLISHED" ? (
                    <Link
                      className="text-[11px] font-black text-kondo-green hover:underline"
                      href={`/stories?story=${submission.slug}`}
                    >
                      Watch reel →
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </FocusedFormShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black text-kondo-ink dark:text-white">
        {label}
      </span>
      {children}
    </label>
  );
}

function ContextSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <SearchableSelect
      label={`${label} · optional`}
      onSelect={onChange}
      options={options}
      placeholder={`Any ${label.toLowerCase()}`}
      searchPlaceholder={`Search ${label.toLowerCase()}s`}
      selected={value}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = ["PUBLISHED", "APPROVED"].includes(status)
    ? "bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300"
    : ["REJECTED", "REMOVED"].includes(status)
      ? "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300"
      : "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300";
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-wider ${tone}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
