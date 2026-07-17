import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ChevronLeft,
  Clock3,
  FileWarning,
  LockKeyhole,
  ScrollText,
  UserRound,
} from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { ReportCaseActions } from "@/components/features/admin/ReportCaseActions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  getReportDetail,
  listAssignableModerators,
  ModerationError,
} from "@/lib/moderation";
import { formatDate, formatRelativeDate } from "@/lib/presentation";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin report" };

export default async function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdminPermission("REPORT_VIEW");
  const { id } = await params;
  let report;
  try {
    report = await getReportDetail(user, id);
  } catch (error) {
    if (error instanceof ModerationError && error.status === 403) {
      redirect("/admin/forbidden");
    }
    throw error;
  }
  if (!report) notFound();
  const assignableUsers = await listAssignableModerators(user);

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Button asChild size="sm" variant="ghost">
        <Link href="/admin/reports">
          <ChevronLeft className="h-4 w-4" /> Reports
        </Link>
      </Button>
      <div className="mt-4">
        <PageHeader
          description={`${report.targetType} · ${report.reason} · version ${report.version}`}
          eyebrow="Moderation case"
          title={`Report ${report.id}`}
        />
      </div>
      <AdminNav currentPath={`/admin/reports/${report.id}`} role={user.role} />

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-black text-orange-700 dark:bg-orange-400/10 dark:text-orange-300">
                {report.status}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600 dark:bg-white/5 dark:text-slate-300">
                {report.reason}
              </span>
              <span className="text-xs text-slate-400">
                Updated {formatRelativeDate(report.updatedAt)}
              </span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <CaseField
                icon={UserRound}
                label="Reporter"
                value={report.reporter?.fullName ?? "Deleted member"}
              />
              <CaseField
                icon={UserRound}
                label="Reported member"
                value={report.subjectUser?.fullName ?? "Unavailable"}
              />
              <CaseField
                icon={FileWarning}
                label="Target"
                value={`${report.targetType} · ${report.targetId}`}
              />
              <CaseField
                icon={UserRound}
                label="Assignee"
                value={report.assignee?.fullName ?? "Unassigned"}
              />
              <CaseField
                icon={Clock3}
                label="Created"
                value={formatDate(report.createdAt)}
              />
              <CaseField
                icon={Clock3}
                label="Assigned"
                value={
                  report.assignedAt
                    ? `${formatDate(report.assignedAt)} by ${report.assignedBy?.fullName ?? "staff"}`
                    : "Not assigned"
                }
              />
            </div>
            <div className="mt-6 rounded-3xl bg-slate-50 p-5 dark:bg-white/[0.03]">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                Member details
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                {report.details || "No additional details were provided."}
              </p>
            </div>
            {report.resolution ? (
              <div className="mt-4 rounded-3xl bg-emerald-50 p-5 dark:bg-emerald-400/5">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  {report.decision}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {report.resolution}
                </p>
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <LockKeyhole className="h-5 w-5 text-kondo-green" />
              <div>
                <h2 className="font-black text-kondo-ink dark:text-white">
                  Restricted evidence
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Access level: {report.permissions.evidenceLevel}. Evidence is
                  never returned to member endpoints.
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-5">
              {report.evidence.map((evidence) => (
                <div
                  className="rounded-3xl border border-slate-200 p-4 dark:border-white/10"
                  key={evidence.id}
                >
                  <p className="font-black text-kondo-ink dark:text-white">
                    {evidence.label}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Captured {formatDate(evidence.capturedAt)}
                  </p>
                  {evidence.unavailable ? (
                    <p className="mt-4 text-sm text-red-600">
                      Evidence snapshot is unavailable.
                    </p>
                  ) : evidence.profile ? (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-white/[0.03]">
                      <p className="font-bold text-kondo-ink dark:text-white">
                        {evidence.profile.displayName}
                        {evidence.profile.username
                          ? ` · @${evidence.profile.username}`
                          : ""}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {evidence.profile.bio || "No profile bio was present."}
                      </p>
                      <p className="mt-3 text-xs text-slate-400">
                        Audience: {evidence.profile.profileAudience} · Created{" "}
                        {new Date(
                          evidence.profile.profileCreatedAt,
                        ).toLocaleString()}
                      </p>
                      {evidence.profile.avatarMediaId ? (
                        <Button
                          asChild
                          className="mt-3"
                          size="sm"
                          variant="secondary"
                        >
                          <Link
                            href={`/admin/media/${evidence.profile.avatarMediaId}`}
                          >
                            Inspect captured avatar
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  ) : evidence.content ? (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-white/[0.03]">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className="font-black text-kondo-green">
                          {evidence.content.targetType}
                        </span>
                        <span>{evidence.content.status}</span>
                        {evidence.content.postType ? (
                          <span>{evidence.content.postType}</span>
                        ) : null}
                      </div>
                      <p className="mt-2 font-bold text-kondo-ink dark:text-white">
                        {evidence.content.title ||
                          `${evidence.content.targetType} content`}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {evidence.content.authorName}
                        {evidence.content.authorUsername
                          ? ` · @${evidence.content.authorUsername}`
                          : ""}{" "}
                        · {evidence.content.communityName}
                      </p>
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {evidence.content.body}
                      </p>
                      {typeof evidence.content.priceFen === "number" ? (
                        <p className="mt-2 text-xs font-bold text-slate-400">
                          ¥{(evidence.content.priceFen / 100).toFixed(2)} ·{" "}
                          {evidence.content.categoryName} ·{" "}
                          {evidence.content.cityName}
                        </p>
                      ) : null}
                      {evidence.content.mediaIds.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {evidence.content.mediaIds.map((mediaId) => (
                            <Button
                              asChild
                              key={mediaId}
                              size="sm"
                              variant="secondary"
                            >
                              <Link href={`/admin/media/${mediaId}`}>
                                Inspect retained media
                              </Link>
                            </Button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {evidence.messages.map((message, index) => (
                        <div
                          className="rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.03]"
                          key={message.id ?? `${message.createdAt}-${index}`}
                        >
                          <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
                            <span className="font-bold">{message.sender}</span>
                            <span>
                              {new Date(message.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {message.body ?? `[${message.type} message]`}
                          </p>
                          {message.attachmentName ? (
                            <p className="mt-2 text-xs text-slate-400">
                              Attachment: {message.attachmentName}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="font-black text-kondo-ink dark:text-white">
              Internal notes
            </h2>
            <div className="mt-4 space-y-3">
              {report.notes.length ? (
                report.notes.map((note) => (
                  <div
                    className="rounded-2xl bg-slate-50 p-4 dark:bg-white/[0.03]"
                    key={note.id}
                  >
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                      <span>{note.author?.fullName ?? "Former staff"}</span>
                      <span>{formatRelativeDate(note.createdAt)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {note.body}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">
                  No internal notes have been added.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <ScrollText className="h-5 w-5 text-kondo-green" />
              <h2 className="font-black text-kondo-ink dark:text-white">
                Case audit timeline
              </h2>
            </div>
            <div className="mt-5 space-y-4">
              {report.auditLogs.map((log) => (
                <div className="border-l-2 border-kondo-mint pl-4" key={log.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-kondo-ink dark:text-white">
                      {log.action}
                    </span>
                    <span className="text-xs text-slate-400">
                      {log.actor?.fullName ?? "System"} ·{" "}
                      {formatRelativeDate(log.createdAt)}
                    </span>
                  </div>
                  {log.newValue ? (
                    <pre className="mt-2 overflow-x-auto rounded-2xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
                      {JSON.stringify(log.newValue, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <aside>
          <Card className="sticky top-24">
            <h2 className="font-black text-kondo-ink dark:text-white">
              Case actions
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Every mutation and internal note is recorded in AuditLog within
              the same database transaction.
            </p>
            <div className="mt-5">
              <ReportCaseActions
                assignableUsers={assignableUsers.filter(
                  (item): item is NonNullable<typeof item> => Boolean(item),
                )}
                currentUserId={user.id}
                initialAssigneeId={report.assignee?.id ?? null}
                initialStatus={report.status}
                initialVersion={report.version}
                permissions={report.permissions}
                reportId={report.id}
              />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function CaseField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-100 p-4 dark:border-white/10">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-kondo-green" />
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="mt-1 break-all text-sm font-bold text-kondo-ink dark:text-white">
          {value}
        </p>
      </div>
    </div>
  );
}
