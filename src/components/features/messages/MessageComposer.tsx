"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Paperclip, Send, SmilePlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
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
}: {
  conversationId?: string;
  recipientId?: string;
  disabled?: boolean;
  sourceType?: "MARKETPLACE_LISTING";
  sourceId?: string;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function clearAttachment() {
    setAttachment(null);
    setAltText("");
    if (fileInput.current) fileInput.current.value = "";
  }

  function selectAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError("");
    if (!file) {
      clearAttachment();
      return;
    }
    if (!supportedMimeTypes.has(file.type)) {
      setError("Choose a JPG, PNG, WebP, or PDF file.");
      clearAttachment();
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
      clearAttachment();
      return;
    }
    setAttachment(file);
    setAltText(
      file.type.startsWith("image/") ? `Message image: ${file.name}` : "",
    );
  }

  async function uploadAttachment(file: File) {
    const purpose =
      file.type === "application/pdf" ? "MESSAGE_DOCUMENT" : "MESSAGE_IMAGE";
    return uploadMediaFile(file, {
      purpose,
      ...(purpose === "MESSAGE_IMAGE" ? { altText } : {}),
    });
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const message = body.trim();
    if ((!message && !attachment) || pending || disabled) return;
    if (attachment?.type.startsWith("image/") && altText.trim().length < 2) {
      setError("Describe the image before sending it.");
      return;
    }

    setPending(true);
    setError("");
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
                  ...(message ? { body: message } : {}),
                  ...(mediaId ? { mediaId } : {}),
                }
              : {
                  recipientId,
                  ...(message ? { body: message } : {}),
                  ...(mediaId ? { mediaId } : {}),
                  ...(sourceType && sourceId ? { sourceType, sourceId } : {}),
                },
          ),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not send the message.");
      }
      setBody("");
      clearAttachment();
      setEmojiOpen(false);
      if (!conversationId && payload?.conversationId) {
        router.replace(`/messages/${payload.conversationId}`);
      } else {
        router.refresh();
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not send the message.",
      );
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form className="relative" onSubmit={submit}>
      {emojiOpen ? (
        <div className="absolute bottom-full left-0 mb-2 flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-2 text-card-foreground shadow-soft">
          {emojis.map((emoji) => (
            <button
              aria-label={`Add ${emoji}`}
              className="grid h-9 w-9 place-items-center rounded-xl text-lg hover:bg-slate-100 dark:hover:bg-white/10"
              key={emoji}
              onClick={() => setBody((current) => `${current}${emoji}`)}
              type="button"
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
      {attachment ? (
        <div className="mb-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-kondo-green dark:bg-white/10">
              {attachment.type === "application/pdf" ? (
                <FileText className="h-4 w-4" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-kondo-ink dark:text-white">
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
              <X className="h-4 w-4" />
            </Button>
          </div>
          {attachment.type.startsWith("image/") ? (
            <input
              aria-label="Image description"
              className="mt-3 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-kondo-green dark:border-white/10 dark:bg-white/5"
              maxLength={240}
              onChange={(event) => setAltText(event.target.value)}
              placeholder="Describe the image"
              value={altText}
            />
          ) : null}
        </div>
      ) : null}
      <div className="flex items-end gap-1 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-white/5 sm:gap-2">
        <Button
          aria-expanded={emojiOpen}
          aria-label="Choose an emoji"
          disabled={disabled || pending}
          onClick={() => setEmojiOpen((current) => !current)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <SmilePlus className="h-5 w-5" />
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
          disabled={disabled || pending || Boolean(attachment)}
          onClick={() => fileInput.current?.click()}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <textarea
          aria-label="Message"
          className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-6 text-kondo-ink outline-none placeholder:text-muted-foreground dark:text-white"
          disabled={disabled || pending}
          maxLength={2000}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            disabled ? "Messaging is unavailable" : "Write a message…"
          }
          rows={1}
          value={body}
        />
        <Button
          aria-label="Send message"
          disabled={disabled || pending || (!body.trim() && !attachment)}
          size="icon"
          type="submit"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 px-2 text-[11px] text-muted-foreground">
        <span>
          {error ||
            (pending
              ? "Uploading and sending securely…"
              : "Enter to send · Images and PDF supported")}
        </span>
        <span>{body.length}/2000</span>
      </div>
    </form>
  );
}
