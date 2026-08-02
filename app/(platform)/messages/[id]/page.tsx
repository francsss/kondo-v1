import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ConversationCallButtons } from "@/components/features/calls/ConversationCallButtons";
import { ConversationActions } from "@/components/features/messages/ConversationActions";
import { ConversationThread } from "@/components/features/messages/ConversationThread";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import type { ConversationMessage } from "@/features/messages/types";
import { getConversationForUser } from "@/lib/messaging";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const conversation = await getConversationForUser(id, user.id);
  if (!conversation?.otherParticipant) notFound();
  const other = conversation.otherParticipant;
  const [block, activity] = await Promise.all([
    prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: other.id },
          { blockerId: other.id, blockedId: user.id },
        ],
      },
      select: { blockerId: true },
    }),
    prisma.$queryRaw<Array<{ active: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM "User"
        WHERE "id" = ${other.id}
          AND "lastActiveAt" >= NOW() - INTERVAL '5 minutes'
      ) AS "active"
    `,
  ]);
  const blockedByMe = block?.blockerId === user.id;
  const recentlyActive = activity[0]?.active ?? false;
  const initialMessages: ConversationMessage[] = conversation.messages.map(
    (message) => ({
      ...message,
      editedAt: message.editedAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString(),
    }),
  );

  return (
    /* Pinned to the visual viewport rather than laid out in the document, so
       the browser cannot drag the conversation upward when it scrolls to
       reveal the focused composer. `--visual-viewport-offset-top` keeps the
       shell aligned with the visible area while the keyboard animates. */
    <div className="fixed inset-x-0 top-[var(--visual-viewport-offset-top,0px)] z-30 flex h-[min(100dvh,var(--visual-viewport-height,100dvh))] min-h-0 flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)]">
      <header className="relative z-20 flex min-h-16 shrink-0 items-center gap-1 border-b border-border/75 bg-card/95 px-2 backdrop-blur-xl sm:gap-2 sm:px-4">
        <Button
          asChild
          aria-label="Back to conversations"
          className="shrink-0"
          size="icon"
          variant="ghost"
        >
          <Link href="/messages">
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
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${
                recentlyActive ? "bg-kondo-green" : "bg-muted-foreground/45"
              }`}
            />
            {recentlyActive ? "Active now" : "Offline"}
          </p>
        </div>
        {!block ? <ConversationCallButtons conversationId={id} /> : null}
        <ConversationActions
          conversationId={id}
          initiallyArchived={Boolean(conversation.archivedAt)}
          initiallyBlocked={blockedByMe}
          otherUserId={other.id}
        />
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
