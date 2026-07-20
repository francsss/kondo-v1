import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  ImageOff,
  MessageCircle,
} from "lucide-react";
import { ConversationActions } from "@/components/features/messages/ConversationActions";
import { MarkConversationRead } from "@/components/features/messages/MarkConversationRead";
import { MessageComposer } from "@/components/features/messages/MessageComposer";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MediaImage } from "@/components/ui/MediaImage";
import { getConversationForUser } from "@/lib/messaging";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/presentation";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Conversation" };

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { page = "1" } = await searchParams;
  const conversation = await getConversationForUser(id, user.id, {
    page: Number(page),
  });
  if (!conversation?.otherParticipant) notFound();
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
  const latestDisplayedMessage =
    conversation.page === 1
      ? conversation.messages[conversation.messages.length - 1]
      : null;

  return (
    <div className="mx-auto max-w-[860px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16">
      {latestDisplayedMessage ? (
        <MarkConversationRead
          conversationId={id}
          latestMessageId={latestDisplayedMessage.id}
        />
      ) : null}
      <Button asChild size="sm" variant="ghost">
        <Link href="/messages">
          <ChevronLeft className="h-4 w-4" /> Messages
        </Link>
      </Button>

      <Card className="mt-4 overflow-hidden p-0">
        <header className="flex items-center gap-3 border-b border-slate-100 p-4 dark:border-white/10 sm:px-5">
          <Link href={`/profile/${other.username ?? other.id}`}>
            <Avatar firstName={other.firstName} lastName={other.lastName} />
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              className="truncate font-black text-kondo-ink hover:text-kondo-green dark:text-white"
              href={`/profile/${other.username ?? other.id}`}
            >
              {other.firstName} {other.lastName}
            </Link>
            <p className="text-xs text-slate-400">Private conversation</p>
          </div>
          <ConversationActions
            conversationId={id}
            initiallyArchived={Boolean(conversation.archivedAt)}
            initiallyBlocked={blockedByMe}
            otherUserId={other.id}
          />
        </header>

        <div className="min-h-[440px] bg-slate-50/70 p-4 dark:bg-white/[0.02] sm:p-6">
          {conversation.pageCount > 1 ? (
            <div className="mb-6 flex items-center justify-center gap-2">
              <Button
                asChild={conversation.page < conversation.pageCount}
                disabled={conversation.page >= conversation.pageCount}
                size="sm"
                variant="secondary"
              >
                {conversation.page < conversation.pageCount ? (
                  <Link href={`/messages/${id}?page=${conversation.page + 1}`}>
                    <ChevronLeft className="h-4 w-4" /> Older
                  </Link>
                ) : (
                  <span>
                    <ChevronLeft className="h-4 w-4" /> Older
                  </span>
                )}
              </Button>
              <span className="px-2 text-[11px] font-bold text-slate-400">
                {conversation.page} / {conversation.pageCount}
              </span>
              <Button
                asChild={conversation.page > 1}
                disabled={conversation.page <= 1}
                size="sm"
                variant="secondary"
              >
                {conversation.page > 1 ? (
                  <Link
                    href={
                      conversation.page === 2
                        ? `/messages/${id}`
                        : `/messages/${id}?page=${conversation.page - 1}`
                    }
                  >
                    Newer <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <span>
                    Newer <ChevronRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </div>
          ) : null}

          <div className="space-y-5">
            {conversation.messages.map((message, index, messages) => {
              const mine = message.senderId === user.id;
              const previous = messages[index - 1];
              const showDate =
                !previous ||
                previous.createdAt.toDateString() !==
                  message.createdAt.toDateString();
              return (
                <div key={message.id}>
                  {showDate ? (
                    <p className="mb-5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {formatDate(message.createdAt)}
                    </p>
                  ) : null}
                  <div
                    className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}
                  >
                    {!mine ? (
                      <Avatar
                        className="mt-auto h-7 w-7 text-[9px]"
                        firstName={message.sender.firstName}
                        lastName={message.sender.lastName}
                      />
                    ) : null}
                    <div
                      className={`max-w-[82%] overflow-hidden rounded-3xl text-sm leading-6 shadow-sm sm:max-w-[72%] ${
                        mine
                          ? "rounded-br-lg bg-kondo-forest text-white dark:bg-emerald-400 dark:text-kondo-ink"
                          : "rounded-bl-lg bg-white text-slate-700 dark:bg-white/10 dark:text-slate-200"
                      }`}
                    >
                      {message.attachment?.kind === "IMAGE" &&
                      message.attachment.id &&
                      message.attachment.url ? (
                        <MediaImage
                          alt={
                            message.attachment.altText ??
                            message.attachment.name ??
                            "Message image"
                          }
                          className="max-h-[420px] w-full object-cover"
                          height={420}
                          mediaId={message.attachment.id}
                          privateMedia
                          sizes="(max-width: 640px) 78vw, 520px"
                          width={640}
                        />
                      ) : null}
                      <div className="px-4 py-2.5">
                        {message.body ? (
                          <p className="whitespace-pre-wrap break-words">
                            {message.body}
                          </p>
                        ) : null}
                        {message.attachment?.kind === "DOCUMENT" &&
                        message.attachment.id &&
                        message.attachment.url ? (
                          <a
                            className={`flex items-center gap-3 rounded-2xl p-3 ${
                              mine
                                ? "bg-white/10 hover:bg-white/15 dark:bg-kondo-ink/10"
                                : "bg-slate-50 hover:bg-slate-100 dark:bg-white/5"
                            }`}
                            href={message.attachment.url}
                          >
                            <FileText className="h-5 w-5 shrink-0" />
                            <span className="min-w-0 flex-1 truncate font-bold">
                              {message.attachment.name ?? "Document"}
                            </span>
                            <Download className="h-4 w-4 shrink-0" />
                          </a>
                        ) : null}
                        {message.attachment && !message.attachment.available ? (
                          <p className="flex items-center gap-2 text-xs opacity-70">
                            <ImageOff className="h-4 w-4" />
                            Attachment unavailable
                          </p>
                        ) : null}
                        <time
                          className={`mt-1 block text-right text-[10px] ${
                            mine
                              ? "text-white/60 dark:text-kondo-ink/60"
                              : "text-slate-400"
                          }`}
                        >
                          {formatTime(message.createdAt)}
                        </time>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {conversation.messages.length === 0 ? (
            <div className="grid min-h-[360px] place-items-center text-center">
              <div>
                <MessageCircle className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 font-black text-kondo-ink dark:text-white">
                  Start a new conversation
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Earlier history hidden from your account stays preserved for
                  the other participant and existing safety evidence.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-100 p-4 dark:border-white/10 sm:p-5">
          {block ? (
            <div className="mb-3 flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
              <Ban className="h-4 w-4" />
              {blockedByMe
                ? "You blocked this user. Unblock them from the conversation menu to continue."
                : "Messaging is unavailable for this conversation."}
            </div>
          ) : null}
          <MessageComposer conversationId={id} disabled={Boolean(block)} />
          <p className="mt-3 text-center text-[11px] text-slate-400">
            Text, emoji, validated images and PDF documents are supported.
          </p>
        </div>
      </Card>
    </div>
  );
}
