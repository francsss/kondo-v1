import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  MessagesSquare,
  Store,
  Tag,
} from "lucide-react";
import { ListingContextStrip } from "@/components/features/marketplace/ListingContextStrip";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getMarketplaceInbox } from "@/lib/marketplace-messaging";
import { formatRelativeDate } from "@/lib/presentation";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Marketplace messages" };
export const dynamic = "force-dynamic";

type Role = "all" | "buying" | "selling";

function inboxHref(input: { role?: Role; page?: number }) {
  const params = new URLSearchParams();
  if (input.role && input.role !== "all") params.set("role", input.role);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/marketplace/messages?${query}` : "/marketplace/messages";
}

/**
 * The Marketplace inbox.
 *
 * Buying and selling are separate jobs, so the two lists are filterable —
 * a seller working through enquiries does not want their own questions to
 * other sellers interleaved. Every row leads with the listing, because that,
 * not the person, is what a marketplace conversation is about.
 */
export default async function MarketplaceMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; page?: string }>;
}) {
  const user = await requireUser();
  const { role: roleParam, page = "1" } = await searchParams;
  const role: Role =
    roleParam === "buying" || roleParam === "selling" ? roleParam : "all";
  const inbox = await getMarketplaceInbox(user.id, {
    page: Number(page),
    role,
  });

  return (
    <div className="mx-auto max-w-[940px] px-3 pb-28 pt-5 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16">
      <Button asChild size="sm" variant="ghost">
        <Link href="/marketplace">
          <ChevronLeft className="h-4 w-4" /> Marketplace
        </Link>
      </Button>
      <div className="mt-3">
        <PageHeader
          description="Your buying and selling conversations, kept with the listings they are about."
          eyebrow="Marketplace"
          title="Marketplace messages"
        />
      </div>

      <nav
        aria-label="Conversation role"
        className="subnav-row mt-6 gap-1 rounded-2xl border border-border/70 bg-card p-1"
      >
        {(
          [
            ["all", "All", MessagesSquare],
            ["buying", "Buying", Tag],
            ["selling", "Selling", Store],
          ] as const
        ).map(([value, label, Icon]) => (
          <Button
            asChild
            className="flex-1 sm:flex-none"
            key={value}
            size="sm"
            variant={role === value ? "primary" : "ghost"}
          >
            <Link href={inboxHref({ role: value })} scroll={false}>
              <Icon className="h-4 w-4" /> {label}
            </Link>
          </Button>
        ))}
      </nav>

      <section
        aria-label="Marketplace conversations"
        className="mt-4 space-y-2"
      >
        {inbox.conversations.map((item) => {
          const other = item.otherParticipant;
          return (
            <Card
              className={`rounded-[1.35rem] p-3 sm:p-3.5 ${
                item.unreadCount
                  ? "border-emerald-200/80 bg-emerald-50/25 dark:border-emerald-400/15 dark:bg-emerald-400/[0.035]"
                  : ""
              }`}
              key={item.conversationId}
            >
              <ListingContextStrip
                compact
                listing={item.listing}
                seller={null}
              />
              <Link
                aria-label={`Open marketplace conversation with ${other.firstName} ${other.lastName} about ${item.listing.title}`}
                className="mt-2 flex items-center gap-3 rounded-2xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={`/marketplace/messages/${item.conversationId}`}
              >
                <Avatar
                  className="h-10 w-10 shrink-0"
                  firstName={other.firstName}
                  lastName={other.lastName}
                  mediaId={other.avatarMediaId}
                  seed={other.id}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-black text-kondo-ink dark:text-white">
                      {other.firstName} {other.lastName}
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                      {item.viewerIsSeller ? "Buyer" : "Seller"}
                    </span>
                    {item.unreadCount > 0 ? (
                      <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black text-primary-foreground shadow-sm">
                        {item.unreadCount > 99 ? "99+" : item.unreadCount}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`mt-0.5 block truncate text-sm ${
                      item.unreadCount
                        ? "font-bold text-muted-foreground dark:text-slate-200"
                        : "text-muted-foreground"
                    }`}
                  >
                    {item.latestMessage.senderId === user.id ? "You: " : ""}
                    {item.latestMessage.preview}
                  </span>
                </span>
                <time className="shrink-0 self-start pt-0.5 text-[11px] font-semibold text-muted-foreground">
                  {formatRelativeDate(item.latestMessage.createdAt)}
                </time>
              </Link>
            </Card>
          );
        })}
      </section>

      {inbox.conversations.length === 0 ? (
        <Card className="mt-5 rounded-3xl py-14 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
            <MessagesSquare className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-black text-kondo-ink dark:text-white">
            {role === "selling"
              ? "No one has asked about your listings yet"
              : role === "buying"
                ? "You have not asked about a listing yet"
                : "No marketplace conversations yet"}
          </h2>
          <p className="mx-auto mt-2 max-w-md px-5 text-sm leading-6 text-muted-foreground">
            Open a listing and use “Chat with seller”. Marketplace conversations
            stay here, with the listing attached — separate from your ordinary
            Messages.
          </p>
          <Button asChild className="mt-5" variant="secondary">
            <Link href="/marketplace">Browse the marketplace</Link>
          </Button>
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
                <Link href={inboxHref({ page: inbox.page - 1, role })}>
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
                <Link href={inboxHref({ page: inbox.page + 1, role })}>
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
