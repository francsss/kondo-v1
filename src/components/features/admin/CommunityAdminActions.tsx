"use client";

import { BadgeCheck, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function CommunityAdminActions({
  communityId,
  initialStatus,
  initialVerified,
  initialName,
  initialDescription,
  initialIcon,
  initialJoinPolicy,
  initialPrivate,
  isOfficial,
}: {
  communityId: string;
  initialStatus: "PENDING_REVIEW" | "ACTIVE" | "ARCHIVED" | "REMOVED";
  initialVerified: boolean;
  initialName: string;
  initialDescription: string;
  initialIcon: string | null;
  initialJoinPolicy: "OPEN" | "REQUEST" | "INVITE_ONLY";
  initialPrivate: boolean;
  isOfficial: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [verified, setVerified] = useState(initialVerified);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [icon, setIcon] = useState(initialIcon ?? "");
  const [joinPolicy, setJoinPolicy] = useState(initialJoinPolicy);
  const [isPrivate, setIsPrivate] = useState(initialPrivate);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/admin/communities/${communityId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        isVerified: verified,
        ...(isOfficial
          ? {
              name,
              description,
              icon: icon.trim() || null,
              joinPolicy,
              isPrivate,
            }
          : {}),
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setPending(false);
    setMessage(
      response?.ok
        ? "Moderation state saved."
        : (payload?.error ?? "Could not update the community."),
    );
    if (response?.ok) router.refresh();
  }

  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-black text-kondo-ink dark:text-white">
            Moderation state
          </h2>
          <p className="text-xs text-slate-400">
            Status and platform verification
          </p>
        </div>
      </div>
      <label className="mt-5 block">
        <span className="mb-2 block text-sm font-bold">Status</span>
        <select
          className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
          onChange={(event) =>
            setStatus(
              event.target.value as
                "PENDING_REVIEW" | "ACTIVE" | "ARCHIVED" | "REMOVED",
            )
          }
          value={status}
        >
          <option value="PENDING_REVIEW">Pending review</option>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
          <option value="REMOVED">Removed</option>
        </select>
      </label>
      <label className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-semibold dark:bg-white/5">
        <input
          checked={verified}
          onChange={(event) => setVerified(event.target.checked)}
          type="checkbox"
        />
        <BadgeCheck className="h-4 w-4 text-kondo-green" />
        Verified by Kondo
      </label>
      {isOfficial ? (
        <div className="mt-5 space-y-4 border-t border-slate-100 pt-5 dark:border-white/10">
          <p className="text-xs font-black uppercase tracking-wider text-kondo-green">
            Official metadata
          </p>
          <input
            className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
          <textarea
            className="min-h-24 w-full rounded-2xl border border-slate-200 bg-transparent p-3 text-sm dark:border-white/10"
            maxLength={500}
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
          <input
            className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
            maxLength={12}
            onChange={(event) => setIcon(event.target.value)}
            placeholder="Icon or emoji"
            value={icon}
          />
          <select
            className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
            onChange={(event) =>
              setJoinPolicy(
                event.target.value as "OPEN" | "REQUEST" | "INVITE_ONLY",
              )
            }
            value={joinPolicy}
          >
            <option value="OPEN">Open</option>
            <option value="REQUEST">Request approval</option>
            <option value="INVITE_ONLY">Invite only</option>
          </select>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input
              checked={isPrivate}
              onChange={(event) => setIsPrivate(event.target.checked)}
              type="checkbox"
            />
            Private community
          </label>
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-400">
          User-created metadata remains owned by the community. Administrators
          use moderation actions instead of rewriting it.
        </p>
      )}
      {message ? (
        <p className="mt-3 text-xs font-semibold text-slate-500" role="status">
          {message}
        </p>
      ) : null}
      <Button className="mt-4" disabled={pending} onClick={save} type="button">
        {pending ? "Saving…" : "Save moderation state"}
      </Button>
    </Card>
  );
}
