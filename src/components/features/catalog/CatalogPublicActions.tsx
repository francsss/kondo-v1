"use client";

import { useRouter } from "next/navigation";
import {
  Bookmark,
  ExternalLink,
  Loader2,
  MessageCircle,
  Send,
  Share2,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export function CatalogPublicActions({
  kind,
  id,
  title,
  contactMethod,
  externalUrl,
}: {
  kind: "product" | "service";
  id: string;
  title: string;
  contactMethod: string;
  externalUrl: string | null;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"inquiry" | "report" | null>(null);
  const [message, setMessage] = useState("");
  const [reportReason, setReportReason] = useState("SCAM");
  const [status, setStatus] = useState("");
  const requestRef = useRef(false);
  const endpoint = kind === "product" ? "products" : "services";

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/${endpoint}/${id}/save`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload) setSaved(Boolean(payload.saved));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [endpoint, id]);

  async function authenticatedRequest(path: string, body?: object) {
    const response = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 401) {
      router.push(
        `/login?next=${encodeURIComponent(window.location.pathname)}`,
      );
      return null;
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(payload?.error ?? "The action could not be completed.");
    return payload;
  }

  async function toggleSave() {
    if (requestRef.current) return;
    requestRef.current = true;
    setPending(true);
    setStatus("");
    try {
      const payload = await authenticatedRequest(`/api/${endpoint}/${id}/save`);
      if (payload) {
        setSaved(Boolean(payload.saved));
        setStatus(payload.saved ? "Saved" : "Removed from saved");
      }
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not save this item.",
      );
    } finally {
      requestRef.current = false;
      setPending(false);
    }
  }

  async function sendInquiry() {
    if (requestRef.current || !message.trim()) return;
    requestRef.current = true;
    setPending(true);
    setStatus("");
    try {
      const payload = await authenticatedRequest(
        `/api/${endpoint}/${id}/inquiries`,
        {
          message: message.trim(),
          topic: `${title} inquiry`,
          clientMessageId: crypto.randomUUID(),
        },
      );
      if (payload?.conversationId)
        router.push(`/messages/${payload.conversationId}`);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "The inquiry could not be sent.",
      );
    } finally {
      requestRef.current = false;
      setPending(false);
    }
  }

  async function sendReport() {
    if (requestRef.current) return;
    requestRef.current = true;
    setPending(true);
    setStatus("");
    try {
      const payload = await authenticatedRequest(
        `/api/${endpoint}/${id}/report`,
        {
          reason: reportReason,
          details: message.trim() || "Please review this catalog item.",
        },
      );
      if (payload) {
        setMode(null);
        setMessage("");
        setStatus("Report sent privately to Kondo moderation.");
      }
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "The report could not be sent.",
      );
    } finally {
      requestRef.current = false;
      setPending(false);
    }
  }

  async function share() {
    const data = { title, url: window.location.href };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else {
      await navigator.clipboard.writeText(data.url);
      setStatus("Link copied");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={() => void toggleSave()}
          variant="secondary"
        >
          <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
          {saved ? "Saved" : "Save"}
        </Button>
        {contactMethod === "KONDO_MESSAGE" ? (
          <Button
            onClick={() => setMode(mode === "inquiry" ? null : "inquiry")}
          >
            <MessageCircle className="h-4 w-4" /> Ask organization
          </Button>
        ) : null}
        {contactMethod === "EXTERNAL_URL" && externalUrl ? (
          <Button asChild>
            <a href={externalUrl} rel="noopener noreferrer" target="_blank">
              Official page <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        ) : null}
        <Button
          aria-label="Share"
          onClick={() => void share()}
          size="icon"
          variant="ghost"
        >
          <Share2 className="h-4 w-4" />
        </Button>
        <Button
          aria-label="Report"
          onClick={() => setMode(mode === "report" ? null : "report")}
          size="icon"
          variant="ghost"
        >
          <ShieldAlert className="h-4 w-4" />
        </Button>
      </div>
      {mode ? (
        <div className="mt-4 rounded-3xl border border-border bg-card p-4">
          {mode === "report" ? (
            <label className="mb-3 block text-sm font-black">
              Reason
              <select
                className="input mt-2"
                onChange={(event) => setReportReason(event.target.value)}
                value={reportReason}
              >
                <option value="SCAM">Scam</option>
                <option value="MISLEADING_PRICE">Misleading price</option>
                <option value="COUNTERFEIT_OR_PROHIBITED_PRODUCT">
                  Counterfeit or prohibited product
                </option>
                <option value="MISLEADING_SERVICE_CLAIM">
                  Misleading service claim
                </option>
                <option value="UNSAFE_EXTERNAL_LINK">
                  Unsafe external link
                </option>
                <option value="UNAUTHORIZED_FEE">Unauthorized fee</option>
                <option value="FALSE_GUARANTEE">
                  False visa, admission, scholarship or employment guarantee
                </option>
                <option value="IMPERSONATION">Impersonation</option>
                <option value="STOLEN_MEDIA">Stolen media</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
          ) : null}
          <label className="text-sm font-black">
            {mode === "inquiry"
              ? "What would you like to know?"
              : "What should Kondo review?"}
            <textarea
              autoFocus
              className="input mt-2 min-h-28 py-3"
              maxLength={2000}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={
                mode === "inquiry"
                  ? "Ask about availability, details, or next steps…"
                  : "Describe the misleading claim, unsafe link, fee, impersonation, or other concern…"
              }
              value={message}
            />
          </label>
          <Button
            className="mt-3"
            disabled={pending || (mode === "inquiry" && !message.trim())}
            onClick={() =>
              void (mode === "inquiry" ? sendInquiry() : sendReport())
            }
            size="sm"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "inquiry" ? (
              <Send className="h-4 w-4" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            {mode === "inquiry" ? "Send inquiry" : "Send private report"}
          </Button>
        </div>
      ) : null}
      {status ? (
        <p
          aria-live="polite"
          className="mt-3 text-xs font-bold text-muted-foreground"
        >
          {status}
        </p>
      ) : null}
    </div>
  );
}
