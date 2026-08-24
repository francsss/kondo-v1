import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ListingContextStrip } from "@/components/features/marketplace/ListingContextStrip";
import { ConversationActions } from "@/components/features/messages/ConversationActions";
import { ConversationThread } from "@/components/features/messages/ConversationThread";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import type { ConversationMessage } from "@/features/messages/types";
import { getMarketplaceThreadContext } from "@/lib/marketplace-messaging";
import { getConversationForUser } from "@/lib/messaging";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Marketplace conversation" };
export const dynamic = "force-dynamic";

/**
 * One listing conversation.
 *
 * The thread itself is the same component Messages uses — same composer, same
 * pagination, same read receipts, same keyboard handling on a phone. The only
 * thing this page adds is the listing the two people are talking about, pinned
 * under the header where it stays visible while they scroll.
 */
export default async function MarketplaceConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const [context, conversation] = await Promise.all([
    getMarketplaceThreadContext(id, user.id),
    getConversationForUser(id, user.id),
  ]);
  if (!context || !conversation?.otherParticipant) notFound();
  const other = conversation.otherParticipant;
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: user.id, blockedId: other.id },
        { blockerId: other.id, blockedId: user.id },
      ],
    },
    select: { blockerId: true },
  });
  const blockedByMe = block?.blockerId === user.id;
  const initialMessages: ConversationMessage[] = conversation.messages.map(
    (message) => ({
      ...message,
      editedAt: message.editedAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString(),
    }),
  );

  return (
    /* Same viewport pinning as a direct conversation: the composer has to stay
       on screen while the mobile keyboard animates, and a document-flow layout
       lets the browser scroll the thread out from under it. */
    <div className="fixed inset-x-0 top-[var(--visual-viewport-offset-top,0px)] z-30 flex h-[min(100dvh,var(--visual-viewport-height,100dvh))] min-h-0 flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)]">
      <header className="relative z-20 shrink-0 border-b border-border/75 bg-card/95 backdrop-blur-xl">
        <div className="flex min-h-16 items-center gap-1 px-2 sm:gap-2 sm:px-4">
          <Button
            asChild
            aria-label="Back to marketplace messages"
            className="shrink-0"
            size="icon"
            variant="ghost"
          >
            <Link href="/marketplace/messages">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <Link
            aria-label={`Open ${other.firstName} ${other.lastName}'s profile`}
            className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={`/profile/${other.username ?? other.id}`}
          >
            <Avatar
              className="h-10 w-10"
              firstName={other.firstName}
              lastName={other.lastName}
              mediaId={other.avatarMediaId}
              seed={other.id}
            />
          </Link>
          <div className="min-w-0 flex-1 px-1">
            <Link
              className="block truncate text-sm font-black text-kondo-ink transition hover:text-kondo-green dark:text-white sm:text-base"
              href={`/profile/${other.username ?? other.id}`}
            >
              {other.firstName} {other.lastName}
            </Link>
            <p className="truncate text-[11px] font-medium text-muted-foreground">
              {context.viewerIsSeller
                ? "Buyer · Marketplace"
                : "Seller · Marketplace"}
            </p>
          </div>
          <ConversationActions
            conversationId={id}
            initiallyArchived={Boolean(conversation.archivedAt)}
            initiallyBlocked={blockedByMe}
            otherUserId={other.id}
          />
        </div>
        <div className="px-2 pb-2 sm:px-4">
          <ListingContextStrip
            compact
            listing={context.listing}
            seller={null}
          />
        </div>
      </header>

      <ConversationThread
        blocked={Boolean(block)}
        blockedByMe={blockedByMe}
        conversationId={id}
        currentUser={{
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          avatarMediaId: user.avatarMediaId,
        }}
        initialMessages={initialMessages}
        initiallyHasOlder={conversation.total > conversation.messages.length}
      />
    </div>
  );
}
