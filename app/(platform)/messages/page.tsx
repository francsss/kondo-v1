import type { Metadata } from "next";
import Link from "next/link";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Inbox,
  MessageCircle,
  Search,
} from "lucide-react";
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
    <div className="mx-auto max-w-[980px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Private, direct conversations with people you meet across Kondo—no friend request required."
        eyebrow="Community conversations"
        title="Messages"
      />

      <nav
        aria-label="Conversation folders"
        className="subnav-row mt-7 max-w-sm gap-2"
      >
        <Button asChild size="sm" variant={archived ? "secondary" : "primary"}>
          <Link href={inboxHref({ query: q })}>
            <Inbox className="h-4 w-4" /> Inbox
          </Link>
        </Button>
        <Button asChild size="sm" variant={archived ? "primary" : "secondary"}>
          <Link href={inboxHref({ query: q, archived: true })}>
            <Archive className="h-4 w-4" /> Archived
          </Link>
        </Button>
      </nav>

      <form className="mt-4 flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm dark:border-white/10 dark:bg-white/5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          aria-label="Search conversations"
          className="w-full bg-transparent text-sm text-kondo-ink outline-none placeholder:text-muted-foreground dark:text-white"
          defaultValue={q}
          name="q"
          placeholder="Search people or messages"
        />
        {archived ? <input name="view" type="hidden" value="archived" /> : null}
      </form>

      <section className="mt-5 space-y-3">
        {inbox.conversations.map((item) => {
          const other = item.otherParticipant;
          const latestMessage = item.latestMessage;
          if (!other || !latestMessage) return null;
          return (
            <Link
              href={`/messages/${item.conversationId}`}
              key={item.conversationId}
            >
              <Card className="mb-3 flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-soft dark:hover:border-emerald-400/20 sm:p-5">
                <Avatar
                  className="h-12 w-12"
                  firstName={other.firstName}
                  lastName={other.lastName}
                  mediaId={other.avatarMediaId}
                  seed={other.id}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-black text-kondo-ink dark:text-white">
                      {other.firstName} {other.lastName}
                    </h2>
                    {item.unreadCount > 0 ? (
                      <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black text-primary-foreground">
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
                <time className="shrink-0 self-start text-xs font-semibold text-muted-foreground">
                  {formatRelativeDate(latestMessage.createdAt)}
                </time>
              </Card>
            </Link>
          );
        })}
      </section>

      {inbox.conversations.length === 0 ? (
        <Card className="mt-5 py-14 text-center">
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
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Start naturally from a member profile, community post, comment,
            marketplace listing or Student Hub answer.
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
