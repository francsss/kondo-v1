"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileVideo2,
  ImagePlus,
  LoaderCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
    const supportedExtensions = ["mp4", "mov", "m4v", "hevc", "h265"];
    const supportedMimeTypes = [
      "video/mp4",
      "video/quicktime",
      "video/x-m4v",
      "video/hevc",
      "video/h265",
    ];
    if (
      !supportedMimeTypes.includes(file.type.toLowerCase()) &&
      !supportedExtensions.includes(extension ?? "")
    ) {
      return "Choose a common mobile video (MP4, MOV, M4V, HEVC or H.265).";
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
      router.refresh();
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
    <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300">
            <FileVideo2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-kondo-green">
              {editing ? "Revision workspace" : "Useful video submission"}
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-kondo-ink dark:text-white">
              {editing
                ? "Address the requested changes"
                : "Tell one clear, useful story"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {editing
                ? editing.moderationReason
                : options.canPublishDirectly
                  ? "Your creator permission allows direct publication after server checks."
                  : "Kondo reviews every member submission before publication."}
            </p>
          </div>
        </div>

        <form className="mt-7 space-y-5" onSubmit={submit}>
          {!editing ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                className="min-h-36 rounded-3xl border border-dashed border-kondo-green/35 bg-kondo-mint/35 p-5 text-left transition hover:bg-kondo-mint/60 dark:bg-emerald-400/5"
                disabled={busy}
                onClick={() => videoInputRef.current?.click()}
                type="button"
              >
                <FileVideo2 className="h-6 w-6 text-kondo-green" />
                <span className="mt-4 block text-sm font-black">
                  {video ? video.name : "Choose a mobile video"}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  MP4, MOV, M4V, HEVC or H.265 · up to 3 minutes and 25 MB
                </span>
              </button>
              <button
                className="min-h-36 rounded-3xl border border-dashed border-border bg-muted/30 p-5 text-left transition hover:border-kondo-green/35"
                disabled={busy}
                onClick={() => posterInputRef.current?.click()}
                type="button"
              >
                <ImagePlus className="h-6 w-6 text-kondo-green" />
                <span className="mt-4 block text-sm font-black">
                  {poster ? poster.name : "Add a portrait poster"}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Recommended for slow connections
                </span>
              </button>
              <input
                accept="video/mp4,video/quicktime,video/x-m4v,video/hevc,video/h265,.mp4,.mov,.m4v,.hevc,.h265"
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
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Short title">
              <input
                className="h-11 w-full rounded-2xl border border-border bg-transparent px-4 text-sm outline-none focus:border-kondo-green"
                maxLength={120}
                minLength={4}
                onChange={(event) => setTitle(event.target.value)}
                required
                value={title}
              />
            </Field>
            <Field label="Category">
              <select
                className="h-11 w-full rounded-2xl border border-border bg-card px-4 text-sm outline-none focus:border-kondo-green"
                onChange={(event) => setCategoryId(event.target.value)}
                required
                value={categoryId}
              >
                <option value="">Choose a category</option>
                {options.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Useful context">
            <textarea
              className="min-h-28 w-full resize-y rounded-2xl border border-border bg-transparent p-4 text-sm leading-6 outline-none focus:border-kondo-green"
              maxLength={700}
              minLength={10}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What should another student understand or do after watching?"
              required
              value={description}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Language">
              <select
                className="h-11 w-full rounded-2xl border border-border bg-card px-4 text-sm"
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
                className="h-11 w-full rounded-2xl border border-border bg-transparent px-4 text-sm"
                onChange={(event) => setCaptions(event.target.value)}
                placeholder="Optional transcript"
                value={captions}
              />
            </Field>
          </div>

          <div>
            <p className="text-xs font-black text-kondo-ink dark:text-white">
              Connect this Story to Kondo
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              These links make the video actionable and improve transparent
              recommendations.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
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
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]">
              <Field label="Related resource">
                <select
                  className="h-11 w-full rounded-2xl border border-border bg-card px-3 text-sm"
                  onChange={(event) => setExternalType(event.target.value)}
                  value={externalType}
                >
                  <option value="">Optional</option>
                  <option value="COMPANY">Company</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="EVENT">Event</option>
                </select>
              </Field>
              <Field label="Kondo resource name">
                <input
                  className="h-11 w-full rounded-2xl border border-border bg-transparent px-4 text-sm disabled:opacity-50"
                  disabled={!externalType}
                  maxLength={160}
                  onChange={(event) => setExternalLabel(event.target.value)}
                  placeholder="e.g. Welcome Week"
                  value={externalLabel}
                />
              </Field>
              <Field label="Kondo page">
                <input
                  className="h-11 w-full rounded-2xl border border-border bg-transparent px-4 text-sm disabled:opacity-50"
                  disabled={!externalType}
                  maxLength={500}
                  onChange={(event) => setExternalHref(event.target.value)}
                  placeholder="/explore/jiaxing/events#welcome-week"
                  value={externalHref}
                />
              </Field>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4">
            <input
              checked={confirmed}
              className="mt-0.5 h-4 w-4 accent-emerald-700"
              onChange={(event) => setConfirmed(event.target.checked)}
              type="checkbox"
            />
            <span className="text-xs leading-5 text-muted-foreground">
              I have the right to share this video. It does not reveal private
              documents, precise home addresses, personal numbers, confidential
              university data, or people who did not consent.
            </span>
          </label>

          {busy ? (
            <div className="rounded-2xl border border-kondo-green/20 bg-kondo-mint/50 p-4 dark:bg-emerald-400/10">
              <div className="flex items-center justify-between text-xs font-black text-kondo-forest dark:text-emerald-300">
                <span>{stage}</span>
                <span>{progress}%</span>
              </div>
              <div
                aria-label="Story upload progress"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={progress}
                className="mt-3 h-2 overflow-hidden rounded-full bg-white/80 dark:bg-black/20"
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
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </p>
          ) : null}
          {success ? (
            <p
              aria-live="polite"
              className="flex items-start gap-2 rounded-2xl bg-kondo-mint p-3 text-xs font-semibold text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {success}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              Your text draft is saved on this device automatically.
            </p>
            <Button disabled={busy} type="submit">
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {editing ? "Resubmit changes" : "Submit Story"}
            </Button>
          </div>
        </form>
      </Card>

      <aside className="space-y-5">
        <Card className="bg-gradient-to-br from-kondo-navy to-kondo-forest text-white">
          <ShieldCheck className="h-6 w-6 text-kondo-lime" />
          <h2 className="mt-4 text-lg font-black">Calm, useful, trustworthy</h2>
          <p className="mt-2 text-xs leading-5 text-white/65">
            Kondo prioritizes verifiable advice, practical context and clear
            next steps—not virality or follower counts.
          </p>
          <ul className="mt-4 space-y-2 text-xs font-semibold text-white/80">
            <li>• Explain one useful idea clearly.</li>
            <li>• Add captions whenever possible.</li>
            <li>• Link the relevant Kondo place or community.</li>
            <li>• Avoid unverified promises and unsafe advice.</li>
          </ul>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-black text-kondo-ink dark:text-white">
              Your submissions
            </h2>
            <Clock3 className="h-4 w-4 text-kondo-green" />
          </div>
          <div className="mt-4 space-y-3">
            {submissions.map((submission) => (
              <div
                className="rounded-2xl border border-border p-3"
                key={submission.id}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">
                      {submission.title}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {submission.category.icon} {submission.category.name} ·
                      revision {submission.revision}
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
                      Watch Story →
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
            {!submissions.length ? (
              <p className="py-5 text-center text-xs text-muted-foreground">
                Your first submission will appear here.
              </p>
            ) : null}
          </div>
        </Card>
      </aside>
    </div>
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
    <label>
      <span className="sr-only">{label}</span>
      <select
        className="h-11 w-full rounded-2xl border border-border bg-card px-3 text-xs"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">{label} · optional</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
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
