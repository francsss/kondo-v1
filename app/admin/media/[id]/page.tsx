import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { MediaAdminActions } from "@/components/features/admin/MediaAdminActions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MediaImage } from "@/components/ui/MediaImage";
import { PageHeader } from "@/components/ui/PageHeader";
import { hasAdminPermission } from "@/lib/authorization";
import { getAdminMedia } from "@/lib/media";
import { formatRelativeDate } from "@/lib/presentation";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin media detail" };

export default async function AdminMediaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdminPermission("MEDIA_VIEW");
  const result = await getAdminMedia(user, (await params).id);
  const media = result.media;

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Review delivery status, validation evidence, ownership, attachment state, and the operational audit trail."
        eyebrow="Kondo operations"
        title="Media inspection"
      />
      <AdminNav currentPath="/admin/media" role={user.role} />
      <Button asChild className="mt-6" size="sm" variant="ghost">
        <Link href="/admin/media">
          <ArrowLeft className="h-4 w-4" /> Back to media
        </Link>
      </Button>

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <div className="space-y-6">
          <Card>
            <div className="grid min-h-72 place-items-center overflow-hidden rounded-2xl bg-slate-100 dark:bg-white/5">
              {media.kind === "IMAGE" &&
              media.scanStatus === "CLEAN" &&
              (media.status === "ACTIVE" || media.retainedAt) ? (
                <MediaImage
                  alt={media.altText ?? "Uploaded image"}
                  className="max-h-[620px] w-full object-contain"
                  height={900}
                  mediaId={media.id}
                  privateMedia={media.visibility === "PRIVATE"}
                  sizes="(min-width: 1280px) 55vw, 90vw"
                  width={1200}
                />
              ) : (
                <div className="text-center">
                  <FileText className="mx-auto h-12 w-12 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-400">
                    {media.status === "ACTIVE" || media.retainedAt
                      ? "Document preview is disabled; delivery forces download."
                      : "The file is not available for delivery."}
                  </p>
                </div>
              )}
            </div>
            {media.status === "ACTIVE" || media.retainedAt ? (
              <Button asChild className="mt-4" size="sm" variant="secondary">
                <a
                  href={`/api/media/${media.id}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open secure delivery <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            ) : null}
          </Card>

          <Card>
            <h2 className="font-black text-kondo-ink dark:text-white">
              Audit trail
            </h2>
            <div className="mt-4 space-y-3">
              {result.auditLogs.map((log) => (
                <div
                  className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"
                  key={log.id}
                >
                  <p className="text-sm font-bold text-kondo-ink dark:text-white">
                    {log.action.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {log.actor?.name ?? "System"} ·{" "}
                    {formatRelativeDate(new Date(log.createdAt))}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-black text-kondo-ink dark:text-white">
                  Validation record
                </h2>
                <p className="text-xs text-slate-400">
                  Storage keys are deliberately hidden.
                </p>
              </div>
            </div>
            <dl className="mt-6 space-y-3 text-sm">
              <Fact label="Status" value={media.status} />
              <Fact label="Scan" value={media.scanStatus} />
              <Fact label="Purpose" value={media.purpose} />
              <Fact label="Visibility" value={media.visibility} />
              <Fact label="Provider" value={media.storageProvider} />
              <Fact label="File" value={media.originalFileName} />
              <Fact
                label="Owner"
                value={
                  media.owner
                    ? `${media.owner.name} · ${media.owner.email}`
                    : "Deleted owner"
                }
              />
              <Fact
                label="MIME"
                value={`${media.declaredMime} → ${media.mimeType ?? "not detected"}`}
              />
              <Fact
                label="Size"
                value={`${(media.sizeBytes / 1024).toFixed(1)} KB`}
              />
              <Fact
                label="Dimensions"
                value={
                  media.width && media.height
                    ? `${media.width} × ${media.height}`
                    : "Not applicable"
                }
              />
              <Fact
                label="Alt text"
                value={media.altText ?? "Not applicable"}
              />
              <Fact
                label="Attached to"
                value={
                  media.attachmentType && media.attachmentId
                    ? `${media.attachmentType} · ${media.attachmentId}`
                    : "Unattached"
                }
              />
              <Fact
                label="Created"
                value={new Date(media.createdAt).toLocaleString()}
              />
              <Fact
                label="Validated"
                value={
                  media.validatedAt
                    ? new Date(media.validatedAt).toLocaleString()
                    : "Not validated"
                }
              />
              <Fact
                label="Removal / rejection"
                value={media.rejectionReason ?? "None"}
              />
              <Fact
                label="Evidence retention"
                value={
                  media.retainedAt
                    ? `${new Date(media.retainedAt).toLocaleString()} · ${media.retentionReason ?? "Moderation hold"}`
                    : "None"
                }
              />
              <Fact
                label="Storage deletion"
                value={
                  media.storageDeletePending ? "Pending retry" : "Complete"
                }
              />
            </dl>
          </Card>

          {hasAdminPermission(user.role, "MEDIA_MANAGE") ? (
            <Card>
              <h2 className="font-black text-kondo-ink dark:text-white">
                Administrative removal
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                Delivery is disabled and storage deletion is retried if the
                provider is temporarily unavailable. Metadata remains audited.
              </p>
              <div className="mt-5">
                <MediaAdminActions
                  mediaId={media.id}
                  removed={media.status === "REMOVED"}
                />
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-white/10">
      <dt className="text-xs font-bold text-slate-400">{label}</dt>
      <dd className="break-words font-semibold text-slate-600 dark:text-slate-200">
        {value}
      </dd>
    </div>
  );
}
