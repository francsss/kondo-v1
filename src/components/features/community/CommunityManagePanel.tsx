"use client";

import {
  Archive,
  ImagePlus,
  MailPlus,
  ShieldCheck,
  Trash2,
  UserRoundCog,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { uploadPublicImage } from "@/lib/client-media";

type Member = {
  id: string;
  role: "OWNER" | "MODERATOR" | "MEMBER";
  user: { id: string; fullName: string; email: string };
};

type AccessRequest = {
  id: string;
  type: "JOIN_REQUEST" | "INVITATION";
  note: string | null;
  user: { fullName: string; email: string };
};

type ManagedPost = {
  id: string;
  type: string;
  status: string;
  title: string | null;
  content: string;
  eventAt: string | null;
  eventValidatedAt: string | null;
  pinnedAt: string | null;
  authorName: string;
};

export function CommunityManagePanel({
  community,
  members,
  requests,
  posts,
  canEditSettings,
  canChangeRoles,
  canArchive,
}: {
  community: {
    id: string;
    name: string;
    description: string;
    joinPolicy: "OPEN" | "REQUEST" | "INVITE_ONLY";
    isPrivate: boolean;
    coverMediaId: string | null;
  };
  members: Member[];
  requests: AccessRequest[];
  posts: ManagedPost[];
  canEditSettings: boolean;
  canChangeRoles: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [cover, setCover] = useState<File | null>(null);

  async function action(url: string, method: string, body?: unknown) {
    setPending(true);
    setMessage("");
    const response = await fetch(url, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setPending(false);
    if (!response?.ok) {
      setMessage(payload?.error ?? "Could not complete that action.");
      return false;
    }
    setMessage("Changes saved.");
    router.refresh();
    return true;
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setPending(true);
      const coverMediaId = cover
        ? await uploadPublicImage(
            cover,
            "COMMUNITY_COVER",
            `${String(form.get("name"))} community cover`,
          )
        : undefined;
      setPending(false);
      await action(`/api/communities/${community.id}`, "PATCH", {
        name: form.get("name"),
        description: form.get("description"),
        joinPolicy: form.get("joinPolicy"),
        isPrivate: form.get("isPrivate") === "on",
        coverMediaId,
      });
    } catch (caught) {
      setPending(false);
      setMessage(
        caught instanceof Error ? caught.message : "Could not update cover.",
      );
    }
  }

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await action(
      `/api/communities/${community.id}/invitations`,
      "POST",
      { email: form.get("email"), note: form.get("note") || undefined },
    );
    if (ok) event.currentTarget.reset();
  }

  return (
    <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        <Card>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
              <UserRoundCog className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-black text-kondo-ink dark:text-white">
                Community settings
              </h2>
              <p className="text-xs text-muted-foreground">
                Identity, access policy and cover
              </p>
            </div>
          </div>
          {canEditSettings ? (
            <form className="mt-5 space-y-4" onSubmit={saveSettings}>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">Name</span>
                <input
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-sm dark:border-white/10"
                  defaultValue={community.name}
                  maxLength={100}
                  name="name"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">
                  Description
                </span>
                <textarea
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-transparent p-4 text-sm dark:border-white/10"
                  defaultValue={community.description}
                  maxLength={1000}
                  name="description"
                  required
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-bold">
                    Join policy
                  </span>
                  <select
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
                    defaultValue={community.joinPolicy}
                    name="joinPolicy"
                  >
                    <option value="OPEN">Open</option>
                    <option value="REQUEST">Approval required</option>
                    <option value="INVITE_ONLY">Invitation only</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 self-end pb-3 text-sm font-semibold">
                  <input
                    defaultChecked={community.isPrivate}
                    name="isPrivate"
                    type="checkbox"
                  />
                  Private community
                </label>
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-300 p-4 text-sm dark:border-white/15">
                <ImagePlus className="h-5 w-5 text-kondo-green" />
                <span className="min-w-0 flex-1 truncate">
                  {cover?.name ??
                    (community.coverMediaId
                      ? "Replace current cover"
                      : "Add a cover image")}
                </span>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) =>
                    setCover(event.target.files?.[0] ?? null)
                  }
                  type="file"
                />
              </label>
              <Button disabled={pending} type="submit">
                Save settings
              </Button>
            </form>
          ) : (
            <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-muted-foreground dark:bg-white/5 dark:text-muted-foreground">
              This user-created community keeps control of its identity and
              cover. Platform administrators can moderate members and content
              below without rewriting community-owned metadata.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="font-black text-kondo-ink dark:text-white">
            Members and roles
          </h2>
          <div className="mt-4 divide-y divide-slate-100 dark:divide-white/10">
            {members.map((member) => (
              <div
                className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center"
                key={member.id}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-kondo-ink dark:text-white">
                    {member.user.fullName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.user.email}
                  </p>
                </div>
                {member.role === "OWNER" ? (
                  <span className="rounded-full bg-kondo-mint px-3 py-1 text-xs font-black text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300">
                    OWNER
                  </span>
                ) : (
                  <>
                    <select
                      aria-label={`Role for ${member.user.fullName}`}
                      className="h-9 rounded-xl border border-slate-200 bg-transparent px-3 text-xs font-bold dark:border-white/10"
                      defaultValue={member.role}
                      disabled={!canChangeRoles || pending}
                      onChange={(event) =>
                        action(
                          `/api/communities/${community.id}/members/${member.id}`,
                          "PATCH",
                          { role: event.target.value },
                        )
                      }
                    >
                      <option value="MEMBER">Member</option>
                      <option value="MODERATOR">Moderator</option>
                    </select>
                    {canChangeRoles ? (
                      <Button
                        disabled={pending}
                        onClick={() =>
                          action(
                            `/api/communities/${community.id}/transfer`,
                            "POST",
                            { userId: member.user.id },
                          )
                        }
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Transfer ownership
                      </Button>
                    ) : null}
                    <Button
                      aria-label={`Remove ${member.user.fullName}`}
                      disabled={pending}
                      onClick={() =>
                        window.confirm("Remove this member?") &&
                        action(
                          `/api/communities/${community.id}/members/${member.id}`,
                          "DELETE",
                        )
                      }
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-black text-kondo-ink dark:text-white">
            Content moderation
          </h2>
          <div className="mt-4 space-y-3">
            {posts.map((post) => (
              <div
                className="rounded-2xl border border-slate-100 p-4 dark:border-white/10"
                key={post.id}
              >
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  <span>{post.type}</span>
                  <span>·</span>
                  <span>{post.status}</span>
                  {post.eventValidatedAt ? (
                    <span className="text-emerald-600">· validated event</span>
                  ) : null}
                  {post.pinnedAt ? <span>· pinned</span> : null}
                </div>
                <h3 className="mt-2 font-bold text-kondo-ink dark:text-white">
                  {post.title ?? post.content.slice(0, 100)}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  By {post.authorName}
                  {post.eventAt
                    ? ` · ${new Date(post.eventAt).toLocaleString()}`
                    : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {post.type === "EVENT" && !post.eventValidatedAt ? (
                    <Action
                      action={() =>
                        action(`/api/posts/${post.id}/moderation`, "POST", {
                          action: "VALIDATE_EVENT",
                        })
                      }
                      label="Validate event"
                    />
                  ) : null}
                  {post.status === "PENDING" ? (
                    <Action
                      action={() =>
                        action(`/api/posts/${post.id}/moderation`, "POST", {
                          action: "PUBLISH",
                        })
                      }
                      label="Publish"
                    />
                  ) : null}
                  {post.status === "PUBLISHED" ? (
                    <>
                      <Action
                        action={() =>
                          action(`/api/posts/${post.id}/moderation`, "POST", {
                            action: post.pinnedAt ? "UNPIN" : "PIN",
                          })
                        }
                        label={post.pinnedAt ? "Unpin" : "Pin"}
                      />
                      <Action
                        action={() =>
                          action(`/api/posts/${post.id}/moderation`, "POST", {
                            action: "REMOVE",
                          })
                        }
                        label="Remove"
                      />
                    </>
                  ) : null}
                  {post.status === "REMOVED" ? (
                    <Action
                      action={() =>
                        action(`/api/posts/${post.id}/moderation`, "POST", {
                          action: "RESTORE",
                        })
                      }
                      label="Restore"
                    />
                  ) : null}
                </div>
              </div>
            ))}
            {!posts.length ? (
              <p className="text-sm text-muted-foreground">
                No posts to moderate.
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      <aside className="space-y-6">
        <Card>
          <div className="flex items-center gap-2">
            <MailPlus className="h-5 w-5 text-kondo-green" />
            <h2 className="font-black text-kondo-ink dark:text-white">
              Invite a member
            </h2>
          </div>
          <form className="mt-4 space-y-3" onSubmit={invite}>
            <input
              className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-sm dark:border-white/10"
              name="email"
              placeholder="Member email"
              required
              type="email"
            />
            <textarea
              className="min-h-20 w-full rounded-2xl border border-slate-200 bg-transparent p-3 text-sm dark:border-white/10"
              maxLength={500}
              name="note"
              placeholder="Optional invitation note"
            />
            <Button disabled={pending} fullWidth type="submit">
              Send invitation
            </Button>
          </form>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-kondo-green" />
            <h2 className="font-black text-kondo-ink dark:text-white">
              Pending access
            </h2>
          </div>
          <div className="mt-4 space-y-3">
            {requests.map((request) => (
              <div
                className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5"
                key={request.id}
              >
                <p className="text-sm font-bold text-kondo-ink dark:text-white">
                  {request.user.fullName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {request.user.email}
                </p>
                {request.note ? (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {request.note}
                  </p>
                ) : null}
                <div className="mt-3 flex gap-2">
                  <Action
                    action={() =>
                      action(
                        `/api/communities/${community.id}/access/${request.id}`,
                        "PATCH",
                        { status: "APPROVED" },
                      )
                    }
                    label="Approve"
                  />
                  <Action
                    action={() =>
                      action(
                        `/api/communities/${community.id}/access/${request.id}`,
                        "PATCH",
                        { status: "REJECTED" },
                      )
                    }
                    label="Reject"
                  />
                </div>
              </div>
            ))}
            {!requests.length ? (
              <p className="text-sm text-muted-foreground">
                No pending requests.
              </p>
            ) : null}
          </div>
        </Card>

        {canArchive ? (
          <Card className="border-red-200 dark:border-red-400/20">
            <div className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-red-600" />
              <h2 className="font-black text-kondo-ink dark:text-white">
                Archive community
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Archiving hides the community from public discovery while
              preserving its members, content and audit history.
            </p>
            <Button
              className="mt-4"
              disabled={pending}
              onClick={() =>
                window.confirm("Archive this community?") &&
                action(`/api/communities/${community.id}`, "DELETE")
              }
              type="button"
              variant="danger"
            >
              <Archive className="h-4 w-4" /> Archive
            </Button>
          </Card>
        ) : null}

        {message ? (
          <p
            className="rounded-2xl bg-kondo-mint p-3 text-sm font-semibold text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300"
            role="status"
          >
            {message}
          </p>
        ) : null}
      </aside>
    </div>
  );
}

function Action({ action, label }: { action: () => void; label: string }) {
  return (
    <button
      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold transition hover:border-kondo-green hover:text-kondo-green dark:border-white/10"
      onClick={action}
      type="button"
    >
      {label}
    </button>
  );
}
