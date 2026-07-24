import type { MediaPurpose, MediaStatus } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  ImageIcon,
  Search,
} from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MediaImage } from "@/components/ui/MediaImage";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAdminMedia } from "@/lib/media";
import { formatRelativeDate } from "@/lib/presentation";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin media" };

const STATUSES = ["PENDING", "PROCESSING", "ACTIVE", "REJECTED", "REMOVED"];
const PURPOSES = [
  "PROFILE_AVATAR",
  "COMMUNITY_COVER",
  "POST_IMAGE",
  "LISTING_IMAGE",
  "GUIDE_COVER",
  "MESSAGE_IMAGE",
  "MESSAGE_DOCUMENT",
  "SCHEDULE_IMPORT",
  "STORY_VIDEO",
  "STORY_POSTER",
  "VERIFICATION_DOCUMENT",
];

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageHref(input: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value) params.set(key, value);
  }
  params.set("page", String(page));
  return `/admin/media?${params.toString()}`;
}

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminPermission("MEDIA_VIEW");
  const params = await searchParams;
  const query = stringParam(params.q)?.trim() || undefined;
  const rawStatus = stringParam(params.status);
  const rawPurpose = stringParam(params.purpose);
  const status = STATUSES.includes(rawStatus ?? "")
    ? (rawStatus as MediaStatus)
    : undefined;
  const purpose = PURPOSES.includes(rawPurpose ?? "")
    ? (rawPurpose as MediaPurpose)
    : undefined;
  const result = await listAdminMedia(user, {
    page: Number(stringParam(params.page) ?? 1),
    query,
    status,
    purpose,
  });
  const hrefInput = { q: query, status, purpose };

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Inspect validated uploads, ownership, attachment state, safety results, and removals without exposing storage keys."
        eyebrow="Kondo operations"
        title="Media"
      />
      <AdminNav currentPath="/admin/media" role={user.role} />

      <Card className="mt-7">
        <form className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_220px_220px_auto]">
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-transparent px-4 text-sm outline-none focus:border-kondo-green dark:border-white/10"
            defaultValue={query}
            name="q"
            placeholder="File name or owner"
          />
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-transparent px-4 text-sm dark:border-white/10"
            defaultValue={status ?? ""}
            name="status"
          >
            <option value="">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-transparent px-4 text-sm dark:border-white/10"
            defaultValue={purpose ?? ""}
            name="purpose"
          >
            <option value="">All purposes</option>
            {PURPOSES.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <Button type="submit">
            <Search className="h-4 w-4" /> Filter
          </Button>
        </form>
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {result.records.map((media) => (
          <Link href={`/admin/media/${media.id}`} key={media.id}>
            <Card className="h-full transition hover:-translate-y-0.5 hover:border-kondo-green/40">
              <div className="grid aspect-[16/9] place-items-center overflow-hidden rounded-2xl bg-slate-100 dark:bg-white/5">
                {media.kind === "IMAGE" && media.status === "ACTIVE" ? (
                  <MediaImage
                    alt={media.altText ?? "Uploaded image"}
                    className="h-full w-full object-cover"
                    height={540}
                    mediaId={media.id}
                    privateMedia={media.visibility === "PRIVATE"}
                    sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 90vw"
                    width={960}
                  />
                ) : media.kind === "DOCUMENT" ? (
                  <FileText className="h-10 w-10 text-muted-foreground" />
                ) : (
                  <ImageIcon className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <div className="mt-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-black text-kondo-ink dark:text-white">
                    {media.originalFileName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {media.owner?.name ?? "Deleted owner"} ·{" "}
                    {formatRelativeDate(new Date(media.createdAt))}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-muted-foreground dark:bg-white/10 dark:text-muted-foreground">
                  {media.status}
                </span>
              </div>
              <p className="mt-3 text-xs font-bold text-emerald-600 dark:text-emerald-300">
                {media.purpose.replaceAll("_", " ")}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      {!result.records.length ? (
        <Card className="mt-6 py-16 text-center text-sm text-muted-foreground">
          No media matches these filters.
        </Card>
      ) : null}

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Page {result.page} of {result.pageCount} · {result.total} records
        </p>
        <div className="flex gap-2">
          {result.page <= 1 ? (
            <Button disabled size="sm" variant="secondary">
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
          ) : (
            <Button asChild size="sm" variant="secondary">
              <Link href={pageHref(hrefInput, result.page - 1)}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Link>
            </Button>
          )}
          {result.page >= result.pageCount ? (
            <Button disabled size="sm" variant="secondary">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button asChild size="sm" variant="secondary">
              <Link href={pageHref(hrefInput, result.page + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
