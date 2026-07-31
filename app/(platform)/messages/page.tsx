import type { Metadata } from "next";
import Link from "next/link";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Inbox,
  MessageCircle,
} from "lucide-react";
import { ConversationSearch } from "@/components/features/messages/ConversationSearch";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getInbox } from "@/lib/messaging";
import { formatRelativeDate } from "@/lib/presentation";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Messages" };

function inboxHref(input: {
  page?: number;
  query?: string;
  archived?: boolean;
}) {
  const params = new URLSearchParams();
  if (input.query) params.set("q", input.query);
  if (input.archived) params.set("view", "archived");
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/messages?${query}` : "/messages";
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; view?: string }>;
}) {
  const user = await requireUser();
  const { q = "", page = "1", view = "inbox" } = await searchParams;
  const archived = view === "archived";
  const inbox = await getInbox(user.id, {
    page: Number(page),
    query: q,
    archived,
  });

  return (
    <div className="mx-auto max-w-[940px] px-3 pb-28 pt-5 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16">
      <PageHeader
        description="Private conversations with the people you meet across Kondo."
        eyebrow="Community conversations"
        title="Messages"
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <nav
          aria-label="Conversation folders"
          className="subnav-row gap-1 rounded-2xl border border-border/70 bg-card p-1"
        >
          <Button
            asChild
            className="flex-1 sm:flex-none"
            size="sm"
            variant={archived ? "ghost" : "primary"}
          >
            <Link href={inboxHref({ query: q })} scroll={false}>
              <Inbox className="h-4 w-4" /> Inbox
            </Link>
          </Button>
          <Button
            asChild
            className="flex-1 sm:flex-none"
            size="sm"
            variant={archived ? "primary" : "ghost"}
          >
            <Link href={inboxHref({ query: q, archived: true })} scroll={false}>
              <Archive className="h-4 w-4" /> Archived
            </Link>
          </Button>
        </nav>
        <ConversationSearch archived={archived} initialQuery={q} />
      </div>

      <section aria-label="Conversations" className="mt-4 space-y-2">
        {inbox.conversations.map((item) => {
          const other = item.otherParticipant;
          const latestMessage = item.latestMessage;
          if (!other || !latestMessage) return null;
          return (
            <Link
              aria-label={`Open conversation with ${other.firstName} ${other.lastName}`}
              className="block rounded-[1.35rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              href={`/messages/${item.conversationId}`}
              key={item.conversationId}
            >
              <Card
                className={`flex items-center gap-3 rounded-[1.35rem] p-3.5 transition duration-200 hover:border-emerald-200 hover:bg-emerald-50/30 hover:shadow-soft dark:hover:border-emerald-400/20 dark:hover:bg-emerald-400/[0.04] sm:gap-4 sm:p-4 ${
                  item.unreadCount
                    ? "border-emerald-200/80 bg-emerald-50/25 dark:border-emerald-400/15 dark:bg-emerald-400/[0.035]"
                    : ""
                }`}
              >
                <Avatar
                  className="h-12 w-12 shrink-0"
                  firstName={other.firstName}
                  lastName={other.lastName}
                  mediaId={other.avatarMediaId}
                  seed={other.id}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-[15px] font-black text-kondo-ink dark:text-white sm:text-base">
                      {other.firstName} {other.lastName}
                    </h2>
                    {item.unreadCount > 0 ? (
                      <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black text-primary-foreground shadow-sm">
                        {item.unreadCount > 99 ? "99+" : item.unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={`mt-1 truncate text-sm ${
                      item.unreadCount
                        ? "font-bold text-muted-foreground dark:text-slate-200"
                        : "text-muted-foreground"
                    }`}
                  >
                    {latestMessage.senderId === user.id ? "You: " : ""}
                    {latestMessage.body ??
                      latestMessage.attachment?.name ??
                      "Attachment"}
                  </p>
                </div>
                <time className="shrink-0 self-start pt-0.5 text-[11px] font-semibold text-muted-foreground sm:text-xs">
                  {formatRelativeDate(latestMessage.createdAt)}
                </time>
              </Card>
            </Link>
          );
        })}
      </section>

      {inbox.conversations.length === 0 ? (
        <Card className="mt-5 rounded-3xl py-14 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
            {archived ? (
              <Archive className="h-6 w-6" />
            ) : (
              <MessageCircle className="h-6 w-6" />
            )}
          </div>
          <h2 className="mt-4 text-lg font-black text-kondo-ink dark:text-white">
            {q
              ? "No matching conversations"
              : archived
                ? "No archived conversations"
                : "Your conversations will appear here"}
          </h2>
          <p className="mx-auto mt-2 max-w-md px-5 text-sm leading-6 text-muted-foreground">
            {q
              ? "Try a different name or message."
              : "Start a conversation from a member profile, post, comment, listing or Student Hub answer."}
          </p>
        </Card>
      ) : null}

      {inbox.pageCount > 1 ? (
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Page {inbox.page} of {inbox.pageCount} · {inbox.total} conversations
          </p>
          <div className="flex gap-2">
            <Button
              asChild={inbox.page > 1}
              disabled={inbox.page <= 1}
              size="sm"
              variant="secondary"
            >
              {inbox.page > 1 ? (
                <Link
                  href={inboxHref({
                    page: inbox.page - 1,
                    query: q,
                    archived,
                  })}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Link>
              ) : (
                <span>
                  <ChevronLeft className="h-4 w-4" /> Previous
                </span>
              )}
            </Button>
            <Button
              asChild={inbox.page < inbox.pageCount}
              disabled={inbox.page >= inbox.pageCount}
              size="sm"
              variant="secondary"
            >
              {inbox.page < inbox.pageCount ? (
                <Link
                  href={inboxHref({
                    page: inbox.page + 1,
                    query: q,
                    archived,
                  })}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span>
                  Next <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
