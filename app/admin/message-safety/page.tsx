import type { Metadata } from "next";
import Link from "next/link";
import {
  Archive,
  Ban,
  FileWarning,
  Flag,
  MessageCircle,
  Paperclip,
  ShieldCheck,
} from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getMessageSafetyOverview } from "@/lib/messaging";
import { formatRelativeDate } from "@/lib/presentation";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Message safety" };

export default async function MessageSafetyPage() {
  const user = await requireAdminPermission("MESSAGE_SAFETY_VIEW");
  const overview = await getMessageSafetyOverview(user);
  const metrics = [
    {
      label: "Direct conversations",
      value: overview.metrics.directConversations,
      icon: MessageCircle,
    },
    {
      label: "Messages · 24h",
      value: overview.metrics.messages24h,
      icon: ShieldCheck,
    },
    {
      label: "Attachment messages",
      value: overview.metrics.attachmentMessages,
      icon: Paperclip,
    },
    {
      label: "Active blocks",
      value: overview.metrics.activeBlocks,
      icon: Ban,
    },
    {
      label: "Open reports",
      value: overview.metrics.openReports,
      icon: Flag,
    },
    {
      label: "Archived histories",
      value: overview.metrics.archivedMemberships,
      icon: Archive,
    },
  ];

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Operational messaging health without general access to private conversations."
        eyebrow="Trust and safety"
        title="Message safety"
      />
      <AdminNav currentPath="/admin/message-safety" role={user.role} />

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-3xl font-black text-kondo-ink dark:text-white">
                {value.toLocaleString()}
              </span>
            </div>
            <p className="mt-4 text-sm font-bold text-slate-500 dark:text-slate-300">
              {label}
            </p>
          </Card>
        ))}
      </section>

      <Card className="mt-7 border-emerald-200 bg-emerald-50/70 dark:border-emerald-400/20 dark:bg-emerald-400/5">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-kondo-green" />
          <div>
            <h2 className="font-black text-kondo-ink dark:text-white">
              Privacy boundary
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Administrators cannot browse raw private conversations. Message
              evidence is available only inside a member-created report and is
              redacted according to the reviewer&apos;s permission level.
            </p>
          </div>
        </div>
      </Card>

      <Card className="mt-7 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <h2 className="font-black text-kondo-ink dark:text-white">
              Recent conversation reports
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Report-bound evidence only
            </p>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link href="/admin/reports?targetType=Conversation">
              Open report queue
            </Link>
          </Button>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {overview.recentReports.map((report) => (
            <div className="flex items-center gap-4 px-5 py-4" key={report.id}>
              <FileWarning className="h-5 w-5 text-orange-500" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-kondo-ink dark:text-white">
                  {report.reason} · {report.status}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {report.assigneeName
                    ? `Assigned to ${report.assigneeName}`
                    : "Unassigned"}{" "}
                  · {formatRelativeDate(report.createdAt)}
                </p>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/admin/reports/${report.id}`}>Review</Link>
              </Button>
            </div>
          ))}
          {overview.recentReports.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-slate-400">
              No conversation reports have been submitted.
            </p>
          ) : null}
        </div>
      </Card>

      <p className="mt-5 text-xs text-slate-400">
        {overview.metrics.clearedMemberships.toLocaleString()} participant
        histories are hidden for their owners while shared records remain
        retained for the other participant and report evidence.
      </p>
    </div>
  );
}
