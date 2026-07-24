"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BookOpenText,
  Bus,
  Check,
  Clock3,
  FileText,
  HandHeart,
  HeartPulse,
  Home,
  Plus,
  Send,
  UsersRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { CommunityRequestDto } from "@/lib/community-requests";
import {
  lockBodyScroll,
  makeBodySiblingsInert,
} from "@/lib/modal-accessibility";
import { cn } from "@/lib/utils";

const categoryPresentation = {
  ACADEMIC: { label: "Academic", icon: BookOpenText },
  HOUSING: { label: "Housing", icon: Home },
  TRANSPORT: { label: "Transport", icon: Bus },
  DOCUMENTS: { label: "Documents", icon: FileText },
  HEALTH: { label: "Health", icon: HeartPulse },
  OTHER: { label: "Other", icon: HandHeart },
} as const;

const statusPresentation = {
  OPEN: {
    label: "Open",
    className:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
  },
  IN_PROGRESS: {
    label: "In Progress",
    className:
      "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  },
  CLOSED: {
    label: "Closed",
    className: "bg-muted text-muted-foreground",
  },
} as const;

const priorityPresentation = {
  URGENT: {
    label: "Urgent",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300",
  },
  IMPORTANT: {
    label: "Important",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300",
  },
  NORMAL: {
    label: "Normal",
    className: "border-border bg-card text-muted-foreground",
  },
} as const;

function remainingTime(expiresAt: string, closed: boolean) {
  if (closed) return "Closed";
  const milliseconds = new Date(expiresAt).getTime() - Date.now();
  if (milliseconds <= 0) return "Expired";
  const minutes = Math.ceil(milliseconds / 60_000);
  if (minutes < 60) return `${minutes}m remaining`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours}h remaining`;
  const days = Math.ceil(hours / 24);
  return `${days}d remaining`;
}

export function CommunityRequestsPanel({
  communityId,
  communityName,
  communityRequests,
  myRequests,
  isMember,
  canCreate,
}: {
  communityId: string;
  communityName: string;
  communityRequests: CommunityRequestDto[];
  myRequests: CommunityRequestDto[];
  isMember: boolean;
  canCreate: boolean;
}) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [composerOpen, setComposerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!composerOpen) return;
    const unlockBody = lockBodyScroll();
    const overlay = document.querySelector<HTMLElement>(
      "[data-request-composer]",
    );
    const restoreSiblings = overlay
      ? makeBodySiblingsInert(overlay)
      : undefined;
    const focusTimer = window.setTimeout(
      () => document.getElementById("request-title")?.focus(),
      reducedMotion ? 0 : 180,
    );

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setComposerOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
      restoreSiblings?.();
      unlockBody();
    };
  }, [composerOpen, reducedMotion]);

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const expiration = new Date(String(form.get("expiresAt")));
      if (Number.isNaN(expiration.getTime())) {
        throw new Error("Choose a valid expiration date.");
      }
      const response = await fetch(`/api/communities/${communityId}/requests`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.get("category"),
          priority: form.get("priority"),
          title: form.get("title"),
          description: form.get("description"),
          expiresAt: expiration.toISOString(),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not create this request.");
      }
      setComposerOpen(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not create this request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function help(requestId: string) {
    setPendingId(requestId);
    setError("");
    const response = await fetch(`/api/community-requests/${requestId}/help`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setPendingId("");
    if (!response?.ok) {
      setError(payload?.error ?? "Could not offer help.");
      return;
    }
    router.refresh();
  }

  async function close(requestId: string) {
    setPendingId(requestId);
    setError("");
    const response = await fetch(`/api/community-requests/${requestId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CLOSED" }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setPendingId("");
    if (!response?.ok) {
      setError(payload?.error ?? "Could not close this request.");
      return;
    }
    router.refresh();
  }

  if (!isMember) {
    return (
      <section
        aria-labelledby="community-requests-heading"
        className="mx-auto max-w-4xl px-3 pb-16 pt-6 sm:px-6 sm:pt-8"
        id="requests"
      >
        <Card className="rounded-[1.75rem] py-14 text-center">
          <HandHeart
            aria-hidden="true"
            className="mx-auto h-9 w-9 text-kondo-green"
          />
          <h2
            className="mt-4 text-xl font-black text-kondo-ink dark:text-white"
            id="community-requests-heading"
          >
            Requests belong to community members
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Join {communityName} to see requests and offer help.
          </p>
        </Card>
      </section>
    );
  }

  return (
    <>
      <section
        aria-labelledby="community-requests-heading"
        className="mx-auto max-w-[1120px] scroll-mt-24 px-3 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-10"
        id="requests"
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
              Community care
            </p>
            <h2
              className="mt-1 text-2xl font-black tracking-[-0.035em] text-kondo-ink dark:text-white sm:text-3xl"
              id="community-requests-heading"
            >
              Requests
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Ask for practical help and let the community know when you can
              step in.
            </p>
          </div>
          {canCreate ? (
            <Button
              className="shrink-0"
              onClick={() => {
                setError("");
                setComposerOpen(true);
              }}
              size="sm"
              type="button"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              <span className="hidden sm:inline">New request</span>
              <span className="sm:hidden">New</span>
            </Button>
          ) : null}
        </div>

        {error ? (
          <p
            className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <RequestSection
          canHelp={canCreate}
          description="Active requests from members of this community."
          empty="There are no active community requests."
          idPrefix="request"
          onClose={close}
          onHelp={help}
          pendingId={pendingId}
          requests={communityRequests}
          title="Community Requests"
        />
        <RequestSection
          canHelp={canCreate}
          description="Requests you created, including recently closed items."
          empty="You have not created a request yet."
          idPrefix="my-request"
          onClose={close}
          onHelp={help}
          pendingId={pendingId}
          requests={myRequests}
          title="My Requests"
        />
      </section>

      {mounted
        ? createPortal(
            <AnimatePresence>
              {composerOpen ? (
                <motion.div
                  animate={{ opacity: 1 }}
                  aria-labelledby="request-composer-title"
                  aria-modal="true"
                  className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-md sm:p-5"
                  data-request-composer
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) {
                      setComposerOpen(false);
                    }
                  }}
                  role="dialog"
                  transition={{ duration: reducedMotion ? 0 : 0.18 }}
                >
                  <motion.div
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="my-5 w-full max-w-xl rounded-[2rem] border border-border bg-card p-5 text-card-foreground shadow-2xl sm:p-7"
                    exit={{
                      opacity: 0,
                      scale: reducedMotion ? 1 : 0.98,
                      y: reducedMotion ? 0 : 8,
                    }}
                    initial={{
                      opacity: 0,
                      scale: reducedMotion ? 1 : 0.98,
                      y: reducedMotion ? 0 : 10,
                    }}
                    transition={{
                      duration: reducedMotion ? 0 : 0.2,
                      ease: "easeOut",
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
                          {communityName}
                        </p>
                        <h2
                          className="mt-1 text-2xl font-black tracking-[-0.03em] text-kondo-ink dark:text-white"
                          id="request-composer-title"
                        >
                          Create a request
                        </h2>
                      </div>
                      <Button
                        aria-label="Close request composer"
                        onClick={() => setComposerOpen(false)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <X aria-hidden="true" className="h-5 w-5" />
                      </Button>
                    </div>

                    <form className="mt-6 space-y-4" onSubmit={submitRequest}>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FieldSelect
                          label="Category"
                          name="category"
                          options={Object.entries(categoryPresentation).map(
                            ([value, item]) => ({
                              value,
                              label: item.label,
                            }),
                          )}
                        />
                        <FieldSelect
                          label="Priority"
                          name="priority"
                          options={[
                            { value: "NORMAL", label: "Normal" },
                            { value: "IMPORTANT", label: "Important" },
                            { value: "URGENT", label: "Urgent" },
                          ]}
                        />
                      </div>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold">
                          Title
                        </span>
                        <input
                          className="h-11 w-full rounded-2xl border border-border bg-transparent px-4 text-sm outline-none transition focus:border-kondo-green"
                          id="request-title"
                          maxLength={140}
                          minLength={3}
                          name="title"
                          placeholder="What do you need help with?"
                          required
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold">
                          Short description
                        </span>
                        <textarea
                          className="min-h-28 w-full resize-y rounded-2xl border border-border bg-transparent p-4 text-sm leading-6 outline-none transition focus:border-kondo-green"
                          maxLength={500}
                          minLength={10}
                          name="description"
                          placeholder="Share only the details people need to understand the request."
                          required
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold">
                          Expires
                        </span>
                        <input
                          className="h-11 w-full rounded-2xl border border-border bg-transparent px-4 text-sm outline-none transition focus:border-kondo-green"
                          name="expiresAt"
                          required
                          type="datetime-local"
                        />
                        <span className="mt-1.5 block text-[11px] font-semibold text-muted-foreground">
                          Up to 30 days from now.
                        </span>
                      </label>
                      {error ? (
                        <p
                          className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300"
                          role="alert"
                        >
                          {error}
                        </p>
                      ) : null}
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          onClick={() => setComposerOpen(false)}
                          type="button"
                          variant="ghost"
                        >
                          Cancel
                        </Button>
                        <Button disabled={submitting} type="submit">
                          <Send aria-hidden="true" className="h-4 w-4" />
                          {submitting ? "Creating…" : "Create request"}
                        </Button>
                      </div>
                    </form>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}

function RequestSection({
  title,
  description,
  empty,
  idPrefix,
  canHelp,
  requests,
  pendingId,
  onHelp,
  onClose,
}: {
  title: string;
  description: string;
  empty: string;
  idPrefix: "request" | "my-request";
  canHelp: boolean;
  requests: CommunityRequestDto[];
  pendingId: string;
  onHelp: (requestId: string) => void;
  onClose: (requestId: string) => void;
}) {
  const headingId = `request-section-${title.toLowerCase().replaceAll(" ", "-")}-heading`;
  return (
    <section className="mt-9" aria-labelledby={headingId}>
      <div className="flex items-end justify-between gap-4 px-1">
        <div>
          <h3
            className="text-lg font-black text-kondo-ink dark:text-white sm:text-xl"
            id={headingId}
          >
            {title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-black text-muted-foreground">
          {requests.length}
        </span>
      </div>
      {requests.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              canHelp={canHelp}
              onClose={onClose}
              onHelp={onHelp}
              pending={pendingId === request.id}
              request={request}
              requestId={`${idPrefix}-${request.id}`}
            />
          ))}
        </div>
      ) : (
        <Card className="mt-4 rounded-[1.5rem] border-dashed py-10 text-center text-sm text-muted-foreground">
          {empty}
        </Card>
      )}
    </section>
  );
}

function RequestCard({
  request,
  requestId,
  canHelp,
  pending,
  onHelp,
  onClose,
}: {
  request: CommunityRequestDto;
  requestId: string;
  canHelp: boolean;
  pending: boolean;
  onHelp: (requestId: string) => void;
  onClose: (requestId: string) => void;
}) {
  const category = categoryPresentation[request.category];
  const CategoryIcon = category.icon;
  const status = statusPresentation[request.status];
  const priority = priorityPresentation[request.priority];
  const closed = request.status === "CLOSED";

  return (
    <Card
      className={cn(
        "scroll-mt-24 rounded-[1.65rem] p-5 transition duration-200 hover:border-primary/20 hover:shadow-soft",
        closed && "bg-card/70",
      )}
      id={requestId}
    >
      <div className="flex items-start gap-3">
        <span
          aria-label={category.label}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-secondary-foreground"
          title={category.label}
        >
          <CategoryIcon aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
                status.className,
              )}
            >
              {status.label}
            </span>
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
                priority.className,
              )}
            >
              {priority.label}
            </span>
          </div>
          <h4 className="mt-3 text-base font-black leading-snug text-kondo-ink dark:text-white sm:text-lg">
            {request.title}
          </h4>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
        {request.description}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs font-semibold text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
          <span suppressHydrationWarning>
            {remainingTime(request.expiresAt, closed)}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <UsersRound aria-hidden="true" className="h-3.5 w-3.5" />
          {request.helpCount}{" "}
          {request.helpCount === 1 ? "person helping" : "people helping"}
        </span>
      </div>
      {!closed ? (
        <div className="mt-4 flex items-center justify-end gap-2">
          {request.isMine ? (
            <Button
              disabled={pending}
              onClick={() => onClose(request.id)}
              size="sm"
              type="button"
              variant="secondary"
            >
              <Check aria-hidden="true" className="h-4 w-4" />
              {pending ? "Closing…" : "Mark Closed"}
            </Button>
          ) : canHelp ? (
            <Button
              disabled={pending || request.isHelping}
              onClick={() => onHelp(request.id)}
              size="sm"
              type="button"
              variant={request.isHelping ? "soft" : "primary"}
            >
              {request.isHelping ? (
                <Check aria-hidden="true" className="h-4 w-4" />
              ) : (
                <HandHeart aria-hidden="true" className="h-4 w-4" />
              )}
              {pending
                ? "Offering…"
                : request.isHelping
                  ? "Helping"
                  : "I can help"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function FieldSelect({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <select
        className="h-11 w-full rounded-2xl border border-border bg-transparent px-3 text-sm outline-none transition focus:border-kondo-green"
        name={name}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
