"use client";

import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  FileText,
  Loader2,
  Paperclip,
  RefreshCw,
  Send,
  SmilePlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { SentMessagePayload } from "@/features/messages/types";
import { uploadMediaFile } from "@/lib/client-media";

const emojis = ["😊", "👍", "🎉", "🙏", "❤️", "😂", "👋", "✨"];
const supportedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export function MessageComposer({
  conversationId,
  recipientId,
  disabled = false,
  sourceType,
  sourceId,
  onMessageSent,
}: {
  conversationId?: string;
  recipientId?: string;
  disabled?: boolean;
  sourceType?: "MARKETPLACE_LISTING";
  sourceId?: string;
  onMessageSent?: (message: SentMessagePayload) => void;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const pendingRef = useRef(false);
  const clientMessageIdRef = useRef<string | null>(null);
  const uploadedMediaIdRef = useRef<string | null>(null);
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const draftKey = `kondo:message-draft:${conversationId ?? recipientId ?? "new"}`;

  useEffect(() => {
    const restoreDraft = window.setTimeout(() => {
      try {
        setBody(window.localStorage.getItem(draftKey) ?? "");
      } catch {
        // Private browsing can disable storage. Messaging remains functional.
      } finally {
        setDraftReady(true);
      }
    }, 0);
    return () => window.clearTimeout(restoreDraft);
  }, [draftKey]);

  useEffect(() => {
    if (!draftReady) return;
    try {
      if (body) window.localStorage.setItem(draftKey, body);
      else window.localStorage.removeItem(draftKey);
    } catch {
      // Draft persistence is a convenience and never blocks message sending.
    }
  }, [body, draftKey, draftReady]);

  useEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 128)}px`;
  }, [body]);

  function resetAttempt() {
    clientMessageIdRef.current = null;
    setError("");
  }

  function clearAttachment() {
    setAttachment(null);
    setAltText("");
    uploadedMediaIdRef.current = null;
    resetAttempt();
    if (fileInput.current) fileInput.current.value = "";
  }

  function selectAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError("");
    uploadedMediaIdRef.current = null;
    clientMessageIdRef.current = null;
    if (!file) {
      clearAttachment();
      return;
    }
    if (!supportedMimeTypes.has(file.type)) {
      setError("Choose a JPG, PNG, WebP, or PDF file.");
      setAttachment(null);
      setAltText("");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    const maxBytes =
      file.type === "application/pdf" ? 10 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(
        file.type === "application/pdf"
          ? "PDF files must be 10 MB or smaller."
          : "Images must be 8 MB or smaller.",
      );
      setAttachment(null);
      setAltText("");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setAttachment(file);
    setAltText(
      file.type.startsWith("image/") ? `Message image: ${file.name}` : "",
    );
  }

  async function uploadAttachment(file: File) {
    if (uploadedMediaIdRef.current) return uploadedMediaIdRef.current;
    const purpose =
      file.type === "application/pdf" ? "MESSAGE_DOCUMENT" : "MESSAGE_IMAGE";
    const mediaId = await uploadMediaFile(file, {
      purpose,
      ...(purpose === "MESSAGE_IMAGE" ? { altText } : {}),
    });
    uploadedMediaIdRef.current = mediaId;
    return mediaId;
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const message = body.trim();
    if ((!message && !attachment) || pendingRef.current || disabled) return;
    if (attachment?.type.startsWith("image/") && altText.trim().length < 2) {
      setError("Describe the image before sending it.");
      return;
    }

    pendingRef.current = true;
    setPending(true);
    setError("");
    clientMessageIdRef.current ??= window.crypto.randomUUID();
    try {
      const mediaId = attachment
        ? await uploadAttachment(attachment)
        : undefined;
      const response = await fetch(
        conversationId
          ? `/api/conversations/${conversationId}/messages`
          : "/api/messages",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            conversationId
              ? {
                  clientMessageId: clientMessageIdRef.current,
                  ...(message ? { body: message } : {}),
                  ...(mediaId ? { mediaId } : {}),
                }
              : {
                  clientMessageId: clientMessageIdRef.current,
                  recipientId,
                  ...(message ? { body: message } : {}),
                  ...(mediaId ? { mediaId } : {}),
                  ...(sourceType && sourceId ? { sourceType, sourceId } : {}),
                },
          ),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        conversationId?: string;
        error?: string;
        message?: SentMessagePayload;
      } | null;
      if (!response.ok || !payload?.message) {
        throw new Error(payload?.error ?? "Could not send the message.");
      }

      setBody("");
      setAttachment(null);
      setAltText("");
      setEmojiOpen(false);
      uploadedMediaIdRef.current = null;
      clientMessageIdRef.current = null;
      if (fileInput.current) fileInput.current.value = "";
      if (conversationId && onMessageSent) {
        onMessageSent(payload.message);
      } else if (!conversationId && payload.conversationId) {
        router.replace(`/messages/${payload.conversationId}`);
      } else {
        router.refresh();
      }
      requestAnimationFrame(() => textarea.current?.focus());
    } catch (caught) {
      setError(
        navigator.onLine
          ? caught instanceof Error
            ? caught.message
            : "Could not send the message."
          : "You appear to be offline. Reconnect and try again.",
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      window.matchMedia("(pointer: fine)").matches
    ) {
      event.preventDefault();
      void submit();
    }
  }

  const validImage =
    !attachment?.type.startsWith("image/") || altText.trim().length >= 2;
  const canSend =
    !disabled && !pending && Boolean(body.trim() || attachment) && validImage;

  return (
    <form className="relative" onSubmit={submit}>
      {emojiOpen ? (
        <div
          aria-label="Emoji options"
          className="absolute bottom-full left-0 z-10 mb-2 flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-2 text-card-foreground shadow-soft"
          role="group"
        >
          {emojis.map((emoji) => (
            <button
              aria-label={`Add ${emoji}`}
              className="grid h-10 w-10 place-items-center rounded-xl text-lg transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              key={emoji}
              onClick={() => {
                setBody((current) => `${current}${emoji}`);
                resetAttempt();
                textarea.current?.focus();
              }}
              type="button"
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <div
          className="mb-2 flex items-center gap-2 rounded-2xl bg-destructive/8 px-3 py-2 text-xs font-semibold text-destructive"
          id="message-send-error"
          role="alert"
        >
          <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{error}</span>
          <button
            className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 font-black transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={pending}
            onClick={() => void submit()}
            type="button"
          >
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : null}

      {attachment ? (
        <div className="mb-2 rounded-2xl border border-border bg-muted/55 p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-card text-kondo-green">
              {attachment.type === "application/pdf" ? (
                <FileText aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Paperclip aria-hidden="true" className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">
                {attachment.name}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {(attachment.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
            <Button
              aria-label="Remove attachment"
              disabled={pending}
              onClick={clearAttachment}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
          {attachment.type.startsWith("image/") ? (
            <input
              aria-label="Image description"
              className="mt-3 h-10 w-full rounded-xl border border-border bg-card px-3 text-xs outline-none transition focus:border-kondo-green focus:ring-2 focus:ring-kondo-green/10"
              maxLength={240}
              onChange={(event) => {
                setAltText(event.target.value);
                resetAttempt();
              }}
              placeholder="Describe the image"
              value={altText}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex items-end gap-1 rounded-[1.65rem] border border-border bg-background p-1.5 shadow-[0_8px_32px_rgba(13,51,40,0.08)] transition focus-within:border-kondo-green/45 focus-within:ring-4 focus-within:ring-kondo-green/8 dark:bg-white/5 sm:gap-1.5">
        <Button
          aria-expanded={emojiOpen}
          aria-label="Choose an emoji"
          className="h-11 w-11"
          disabled={disabled || pending}
          onClick={() => setEmojiOpen((current) => !current)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <SmilePlus aria-hidden="true" className="h-5 w-5" />
        </Button>
        <input
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          disabled={disabled || pending}
          onChange={selectAttachment}
          ref={fileInput}
          type="file"
        />
        <Button
          aria-label="Attach an image or PDF"
          className="h-11 w-11"
          disabled={disabled || pending || Boolean(attachment)}
          onClick={() => fileInput.current?.click()}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Paperclip aria-hidden="true" className="h-5 w-5" />
        </Button>
        <textarea
          aria-describedby={error ? "message-send-error" : undefined}
          aria-label="Message"
          className="min-h-11 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2.5 text-[15px] leading-6 text-foreground outline-none placeholder:text-muted-foreground"
          disabled={disabled || pending}
          maxLength={2000}
          onChange={(event) => {
            setBody(event.target.value);
            resetAttempt();
          }}
          onKeyDown={onKeyDown}
          placeholder={disabled ? "Messaging is unavailable" : "Message…"}
          ref={textarea}
          rows={1}
          value={body}
        />
        <Button
          aria-label={pending ? "Sending message" : "Send message"}
          className="h-11 w-11"
          disabled={!canSend}
          size="icon"
          type="submit"
        >
          {pending ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Send aria-hidden="true" className="h-4 w-4" />
          )}
        </Button>
      </div>
    </form>
  );
}
