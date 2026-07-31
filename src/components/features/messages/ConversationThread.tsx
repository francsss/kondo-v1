"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  Ban,
  Download,
  FileText,
  ImageOff,
  Loader2,
  MessageCircle,
  WifiOff,
} from "lucide-react";
import { MessageComposer } from "@/components/features/messages/MessageComposer";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { MediaImage } from "@/components/ui/MediaImage";
import {
  mergeConversationMessages,
  messageDayKey,
  messagesBelongToSameGroup,
} from "@/features/messages/presentation";
import type {
  ConversationMessage,
  ConversationMessageWindow,
  MessageParticipant,
  SentMessagePayload,
} from "@/features/messages/types";
import { broadcastMessageCount } from "@/lib/notification-client";

const POLL_INTERVAL_MS = 4_000;
const BOTTOM_THRESHOLD_PX = 96;

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMessageDay(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (messageDayKey(date) === messageDayKey(today)) return "Today";
  if (messageDayKey(date) === messageDayKey(yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date);
}

function MessageBody({ body }: { body: string }) {
  const parts = body.split(/(https?:\/\/[^\s]+)/g);
  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            className="break-all font-semibold underline decoration-current/40 underline-offset-2 hover:decoration-current"
            href={part}
            key={`${part}-${index}`}
            rel="noreferrer noopener"
            target="_blank"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  );
}

async function readPayload<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    (T & { error?: string }) | null;
  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? "Messages could not be refreshed.");
  }
  return payload;
}

export function ConversationThread({
  conversationId,
  currentUser,
  initialMessages,
  initiallyHasOlder,
  blocked,
  blockedByMe,
}: {
  conversationId: string;
  currentUser: MessageParticipant;
  initialMessages: ConversationMessage[];
  initiallyHasOlder: boolean;
  blocked: boolean;
  blockedByMe: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(initialMessages);
  const atBottomRef = useRef(true);
  const initialPositionedRef = useRef(false);
  const pollingRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const markReadIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState(initialMessages);
  const [hasOlder, setHasOlder] = useState(initiallyHasOlder);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [connectionState, setConnectionState] = useState<
    "connected" | "slow" | "offline"
  >("connected");

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const isNearBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return true;
    return (
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
      BOTTOM_THRESHOLD_PX
    );
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    atBottomRef.current = true;
    setNewMessageCount(0);
  }, []);

  const markLatestRead = useCallback(async () => {
    const latest = messagesRef.current.at(-1);
    if (!latest || latest.senderId === currentUser.id) return;
    if (markReadIdRef.current === latest.id) return;
    markReadIdRef.current = latest.id;
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/read`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latestMessageId: latest.id }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        unreadCount?: unknown;
      } | null;
      if (response.ok && typeof payload?.unreadCount === "number") {
        broadcastMessageCount(payload.unreadCount);
      } else if (!response.ok) {
        markReadIdRef.current = null;
      }
    } catch {
      markReadIdRef.current = null;
    }
  }, [conversationId, currentUser.id]);

  useLayoutEffect(() => {
    if (initialPositionedRef.current) return;
    initialPositionedRef.current = true;
    scrollToBottom("auto");
  }, [scrollToBottom]);

  useEffect(() => {
    void markLatestRead();
  }, [markLatestRead]);

  const latestMessageId = messages.at(-1)?.id;
  useEffect(() => {
    if (latestMessageId && atBottomRef.current) void markLatestRead();
  }, [latestMessageId, markLatestRead]);

  const loadOlder = useCallback(async () => {
    const oldest = messagesRef.current[0];
    const viewport = viewportRef.current;
    if (!oldest || !viewport || !hasOlder || loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const previousHeight = viewport.scrollHeight;
    const previousTop = viewport.scrollTop;
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/messages?direction=older&cursor=${encodeURIComponent(oldest.id)}`,
        { credentials: "include", cache: "no-store" },
      );
      const payload = await readPayload<ConversationMessageWindow>(response);
      setMessages((current) =>
        mergeConversationMessages(current, payload.messages),
      );
      setHasOlder(payload.hasMore);
      requestAnimationFrame(() => {
        const currentViewport = viewportRef.current;
        if (!currentViewport) return;
        currentViewport.scrollTop =
          previousTop + currentViewport.scrollHeight - previousHeight;
      });
    } catch {
      // Keep the current history in place; the next upward scroll retries.
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [conversationId, hasOlder]);

  const pollNewMessages = useCallback(async () => {
    if (pollingRef.current || document.visibilityState !== "visible") return;
    if (!navigator.onLine) {
      setConnectionState("offline");
      return;
    }
    pollingRef.current = true;
    const slowTimer = window.setTimeout(
      () => setConnectionState("slow"),
      2_500,
    );
    try {
      const latest = messagesRef.current.at(-1);
      const query = latest
        ? `?direction=newer&cursor=${encodeURIComponent(latest.id)}`
        : "?direction=newer";
      const response = await fetch(
        `/api/conversations/${conversationId}/messages${query}`,
        { credentials: "include", cache: "no-store" },
      );
      const payload = await readPayload<ConversationMessageWindow>(response);
      const unseen = payload.messages.filter(
        (message) => !messagesRef.current.some(({ id }) => id === message.id),
      );
      if (unseen.length > 0) {
        const shouldFollow = atBottomRef.current;
        setMessages((current) =>
          mergeConversationMessages(current, payload.messages),
        );
        if (shouldFollow) {
          requestAnimationFrame(() => {
            scrollToBottom();
            void markLatestRead();
          });
        } else {
          setNewMessageCount((count) => count + unseen.length);
        }
      }
      setConnectionState("connected");
    } catch {
      setConnectionState(navigator.onLine ? "slow" : "offline");
    } finally {
      window.clearTimeout(slowTimer);
      pollingRef.current = false;
    }
  }, [conversationId, markLatestRead, scrollToBottom]);

  useEffect(() => {
    const poll = window.setInterval(
      () => void pollNewMessages(),
      POLL_INTERVAL_MS,
    );
    const handleOnline = () => {
      setConnectionState("connected");
      void pollNewMessages();
    };
    const handleOffline = () => setConnectionState("offline");
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void pollNewMessages();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pollNewMessages]);

  function handleScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nowAtBottom = isNearBottom();
    atBottomRef.current = nowAtBottom;
    if (nowAtBottom) {
      setNewMessageCount(0);
      void markLatestRead();
    }
    if (viewport.scrollTop < 120) void loadOlder();
  }

  function handleMessageSent(message: SentMessagePayload) {
    const sent: ConversationMessage = {
      ...message,
      editedAt: message.editedAt ? String(message.editedAt) : null,
      createdAt: String(message.createdAt),
      sender: currentUser,
    };
    setMessages((current) => mergeConversationMessages(current, [sent]));
    requestAnimationFrame(() => scrollToBottom());
  }

  return (
    <>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.07),transparent_38%)] dark:bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.055),transparent_42%)]">
        <div
          aria-label="Conversation messages"
          className="h-full overflow-y-auto overscroll-contain px-3 py-4 [scrollbar-gutter:stable] sm:px-6 sm:py-5"
          onScroll={handleScroll}
          ref={viewportRef}
          role="log"
        >
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end">
            {hasOlder || loadingOlder ? (
              <div
                className="mb-4 flex min-h-9 justify-center"
                aria-live="polite"
              >
                {loadingOlder ? (
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading
                    earlier messages
                  </span>
                ) : (
                  <Button
                    onClick={() => void loadOlder()}
                    size="sm"
                    variant="ghost"
                  >
                    Load earlier messages
                  </Button>
                )}
              </div>
            ) : messages.length > 0 ? (
              <p className="mb-5 text-center text-[11px] font-semibold text-muted-foreground/75">
                Beginning of this conversation
              </p>
            ) : null}

            {messages.length === 0 ? (
              <div className="grid min-h-[48vh] place-items-center text-center">
                <div>
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
                    <MessageCircle className="h-6 w-6" />
                  </span>
                  <p className="mt-4 font-black text-kondo-ink dark:text-white">
                    Start the conversation
                  </p>
                  <p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-muted-foreground">
                    Send a message whenever you are ready.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                {messages.map((message, index) => {
                  const mine = message.senderId === currentUser.id;
                  const previous = messages[index - 1];
                  const next = messages[index + 1];
                  const showDay =
                    !previous ||
                    messageDayKey(previous.createdAt) !==
                      messageDayKey(message.createdAt);
                  const groupStart =
                    showDay || !messagesBelongToSameGroup(previous, message);
                  const groupEnd = !messagesBelongToSameGroup(message, next);
                  return (
                    <div key={message.id}>
                      {showDay ? (
                        <div
                          className="my-5 flex items-center gap-3"
                          role="separator"
                        >
                          <span className="h-px flex-1 bg-border/65" />
                          <time
                            className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground backdrop-blur"
                            dateTime={message.createdAt}
                          >
                            {formatMessageDay(message.createdAt)}
                          </time>
                          <span className="h-px flex-1 bg-border/65" />
                        </div>
                      ) : null}
                      <div
                        className={`flex items-end gap-2 ${groupStart ? "mt-3" : "mt-1"} ${mine ? "justify-end" : "justify-start"}`}
                      >
                        {!mine ? (
                          groupEnd ? (
                            <Avatar
                              className="h-7 w-7 shrink-0 text-[9px]"
                              firstName={message.sender.firstName}
                              lastName={message.sender.lastName}
                              mediaId={message.sender.avatarMediaId}
                              seed={message.sender.id}
                            />
                          ) : (
                            <span aria-hidden="true" className="w-7 shrink-0" />
                          )
                        ) : null}
                        <div
                          className={`max-w-[84%] overflow-hidden text-[15px] leading-6 shadow-[0_2px_12px_rgba(13,51,40,0.055)] sm:max-w-[70%] ${
                            mine
                              ? `bg-kondo-forest text-white dark:bg-emerald-400 dark:text-kondo-ink ${
                                  groupStart
                                    ? "rounded-t-[1.35rem]"
                                    : "rounded-t-lg"
                                } ${groupEnd ? "rounded-bl-[1.35rem] rounded-br-md" : "rounded-b-lg"}`
                              : `border border-border/55 bg-card text-foreground ${
                                  groupStart
                                    ? "rounded-t-[1.35rem]"
                                    : "rounded-t-lg"
                                } ${groupEnd ? "rounded-br-[1.35rem] rounded-bl-md" : "rounded-b-lg"}`
                          }`}
                        >
                          {message.attachment?.kind === "IMAGE" &&
                          message.attachment.id &&
                          message.attachment.available ? (
                            <a
                              href={`/api/media/${message.attachment.id}`}
                              rel="noreferrer"
                              target="_blank"
                            >
                              <MediaImage
                                alt={
                                  message.attachment.altText ??
                                  message.attachment.name ??
                                  "Message image"
                                }
                                className="max-h-[min(52vh,480px)] w-full object-cover"
                                height={480}
                                mediaId={message.attachment.id}
                                privateMedia
                                sizes="(max-width: 640px) 84vw, 560px"
                                width={720}
                              />
                            </a>
                          ) : null}
                          <div className="px-3.5 py-2 sm:px-4">
                            {message.body ? (
                              <MessageBody body={message.body} />
                            ) : null}
                            {message.attachment?.kind === "DOCUMENT" &&
                            message.attachment.id &&
                            message.attachment.available ? (
                              <a
                                className={`flex min-w-0 items-center gap-3 rounded-xl p-2.5 transition ${
                                  message.body ? "mt-2" : ""
                                } ${
                                  mine
                                    ? "bg-white/10 hover:bg-white/15 dark:bg-kondo-ink/10"
                                    : "bg-muted/70 hover:bg-muted"
                                }`}
                                href={`/api/media/${message.attachment.id}`}
                              >
                                <FileText className="h-5 w-5 shrink-0" />
                                <span className="min-w-0 flex-1 truncate font-bold">
                                  {message.attachment.name ?? "Document"}
                                </span>
                                <Download className="h-4 w-4 shrink-0" />
                              </a>
                            ) : null}
                            {message.attachment &&
                            !message.attachment.available ? (
                              <p className="flex items-center gap-2 text-xs opacity-70">
                                <ImageOff className="h-4 w-4" /> Attachment
                                unavailable
                              </p>
                            ) : null}
                            {groupEnd ? (
                              <time
                                className={`mt-0.5 block text-right text-[10px] ${
                                  mine
                                    ? "text-white/60 dark:text-kondo-ink/60"
                                    : "text-muted-foreground"
                                }`}
                                dateTime={message.createdAt}
                              >
                                {formatMessageTime(message.createdAt)}
                              </time>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {newMessageCount > 0 ? (
          <Button
            className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 shadow-soft"
            onClick={() => {
              scrollToBottom();
              void markLatestRead();
            }}
            size="sm"
          >
            <ArrowDown className="h-4 w-4" />
            {newMessageCount === 1
              ? "1 new message"
              : `${newMessageCount} new messages`}
          </Button>
        ) : null}
      </div>

      <div className="safe-bottom shrink-0 border-t border-border/80 bg-card/95 px-2.5 py-2 backdrop-blur-xl sm:px-4 sm:py-3">
        <div className="mx-auto max-w-3xl">
          {connectionState !== "connected" ? (
            <p
              className="mb-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
              role="status"
            >
              {connectionState === "offline" ? (
                <WifiOff className="h-3.5 w-3.5" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {connectionState === "offline"
                ? "Offline — your draft is saved"
                : "Reconnecting…"}
            </p>
          ) : null}
          {blocked ? (
            <div className="mb-2 flex items-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
              <Ban className="h-4 w-4 shrink-0" />
              {blockedByMe
                ? "You blocked this user. Unblock them from the conversation menu to continue."
                : "Messaging is unavailable for this conversation."}
            </div>
          ) : null}
          <MessageComposer
            conversationId={conversationId}
            disabled={blocked}
            onMessageSent={handleMessageSent}
          />
        </div>
      </div>
    </>
  );
}
