import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Clock3,
  Link2,
  MessageSquareHeart,
  Timer,
  UserRound,
} from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { PetFeedbackAdminActions } from "@/components/features/admin/PetFeedbackAdminActions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { hasAdminPermission } from "@/lib/authorization";
import { getPetFeedback } from "@/lib/pet-feedback";
import { formatDate, formatRelativeDate } from "@/lib/presentation";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "MVP feedback detail" };

export default async function AdminFeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdminPermission("FEEDBACK_VIEW");
  const feedback = await getPetFeedback(user, (await params).id);
  if (!feedback) notFound();

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Button asChild size="sm" variant="ghost">
        <Link href="/admin/feedback">
          <ChevronLeft className="h-4 w-4" /> MVP feedback
        </Link>
      </Button>
      <div className="mt-4">
        <PageHeader
          description={`${feedback.category} · ${feedback.pageArea} · version ${feedback.version}`}
          eyebrow="Member insight"
          title={`Feedback ${feedback.id}`}
        />
      </div>
      <AdminNav
        currentPath={`/admin/feedback/${feedback.id}`}
        role={user.role}
      />

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
                {feedback.status.replace("_", " ")}
              </span>
              <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-black text-muted-foreground">
                {feedback.category}
              </span>
              <span className="text-xs text-muted-foreground">
                Updated {formatRelativeDate(feedback.updatedAt)}
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <DetailField
                icon={UserRound}
                label="Member"
                value={
                  feedback.user
                    ? `${feedback.user.firstName} ${feedback.user.lastName}`
                    : "Deleted member"
                }
              />
              <DetailField
                icon={Clock3}
                label="Submitted"
                value={formatDate(feedback.createdAt)}
              />
              <DetailField
                icon={Link2}
                label="Page"
                value={feedback.pagePath}
              />
              <DetailField
                icon={Timer}
                label="Completion time"
                value={
                  feedback.submittedAfterMs === null
                    ? "Unavailable"
                    : `${Math.max(1, Math.round(feedback.submittedAfterMs / 1000))} seconds`
                }
              />
            </div>

            <div className="mt-6 rounded-3xl bg-muted/60 p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                Member feedback
              </p>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-kondo-ink dark:text-white">
                {feedback.message}
              </p>
            </div>

            {feedback.user ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link
                    href={`/profile/${feedback.user.username ?? feedback.user.id}`}
                  >
                    View member profile
                  </Link>
                </Button>
                <span className="self-center text-xs text-muted-foreground">
                  {feedback.user.email}
                </span>
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-kondo-green dark:bg-emerald-400/10">
                <MessageSquareHeart className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-black text-kondo-ink dark:text-white">
                  Internal conversation
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  These notes are visible only to authorized Kondo staff.
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {feedback.notes.length ? (
                feedback.notes.map((note) => (
                  <div
                    className="rounded-3xl border border-border p-4"
                    key={note.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-black text-kondo-ink dark:text-white">
                        {note.author
                          ? `${note.author.firstName} ${note.author.lastName}`
                          : "Former staff member"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(note.createdAt)}
                      </p>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                      {note.body}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-3xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  No internal notes yet.
                </p>
              )}
            </div>
          </Card>
        </div>

        <aside>
          <Card className="xl:sticky xl:top-24">
            <h2 className="font-black text-kondo-ink dark:text-white">
              Feedback workflow
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Keep the status current and record decisions as internal notes.
            </p>
            <div className="mt-5">
              <PetFeedbackAdminActions
                canManage={hasAdminPermission(user.role, "FEEDBACK_MANAGE")}
                feedbackId={feedback.id}
                initialStatus={feedback.status}
                initialVersion={feedback.version}
                key={`${feedback.id}:${feedback.version}`}
              />
            </div>
            {feedback.resolvedAt ? (
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Resolved {formatRelativeDate(feedback.resolvedAt)}
                {feedback.resolvedBy
                  ? ` by ${feedback.resolvedBy.firstName} ${feedback.resolvedBy.lastName}`
                  : ""}
                .
              </p>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function DetailField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border p-4">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-kondo-green" />
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-bold text-kondo-ink dark:text-white">
          {value}
        </p>
      </div>
    </div>
  );
}
