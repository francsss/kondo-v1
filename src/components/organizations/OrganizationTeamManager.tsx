"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  MailPlus,
  RefreshCw,
  Search,
  Trash2,
  UserRoundCog,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

type TeamMember = {
  userId: string;
  role: string;
  status: string;
  joinedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarMediaId: string | null;
    status: string;
  };
};
type Invitation = {
  id: string;
  emailNormalized: string;
  intendedRole: string;
  status: string;
  expiresAt: string;
  createdAt: string;
};

const roles = [
  ["ADMIN", "Administrator", "Manages profile, team and verification."],
  ["EDITOR", "Editor", "Edits organization profile and future content."],
  ["VIEWER", "Viewer", "Reads the dashboard and activity."],
] as const;

export function OrganizationTeamManager({
  organizationId,
  currentUserId,
  currentRole,
  initialMembers,
  initialInvitations,
}: {
  organizationId: string;
  currentUserId: string;
  currentRole: string;
  initialMembers: TeamMember[];
  initialInvitations: Invitation[];
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "EDITOR" | "VIEWER">("EDITOR");
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return members;
    return members.filter((member) =>
      `${member.user.firstName} ${member.user.lastName} ${member.user.email}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [members, query]);

  async function invite(event: FormEvent) {
    event.preventDefault();
    setSaving("invite");
    setError("");
    setSuccess("");
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/invitations`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, role }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "The invitation could not be sent.");
        return;
      }
      setEmail("");
      setSuccess(data.message ?? "Invitation sent.");
      router.refresh();
    } catch {
      setError("Kondo could not reach the server.");
    } finally {
      setSaving("");
    }
  }

  async function changeRole(userId: string, nextRole: string) {
    setSaving(userId);
    setError("");
    const previous = members;
    setMembers((current) =>
      current.map((member) =>
        member.userId === userId ? { ...member, role: nextRole } : member,
      ),
    );
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/members/${userId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: nextRole }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMembers(previous);
        setError(data.error ?? "The role could not be changed.");
      }
    } catch {
      setMembers(previous);
      setError("Kondo could not reach the server.");
    } finally {
      setSaving("");
    }
  }

  async function removeMember(userId: string) {
    if (!window.confirm("Remove this member's organization access?")) return;
    setSaving(userId);
    setError("");
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/members/${userId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "The member could not be removed.");
        return;
      }
      setMembers((current) =>
        current.filter((member) => member.userId !== userId),
      );
    } catch {
      setError("Kondo could not reach the server.");
    } finally {
      setSaving("");
    }
  }

  async function cancelInvitation(invitationId: string) {
    setSaving(invitationId);
    setError("");
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/invitations/${invitationId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "The invitation could not be cancelled.");
        return;
      }
      setInvitations((current) =>
        current.filter((invitation) => invitation.id !== invitationId),
      );
    } catch {
      setError("Kondo could not reach the server.");
    } finally {
      setSaving("");
    }
  }

  async function resendInvitation(invitationId: string) {
    const invitation = invitations.find((item) => item.id === invitationId);
    if (!invitation) return;
    setSaving(invitationId);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/invitations/${invitationId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "RESEND",
            role: invitation.intendedRole,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "The invitation could not be resent.");
        return;
      }
      setSuccess(data.message ?? "Invitation resent.");
      router.refresh();
    } catch {
      setError("Kondo could not reach the server.");
    } finally {
      setSaving("");
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-4xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3">
          <MailPlus className="h-5 w-5 text-kondo-green" />
          <div>
            <h2 className="text-xl font-black">Invite a teammate</h2>
            <p className="text-sm text-muted-foreground">
              They sign in with their own personal Kondo account.
            </p>
          </div>
        </div>
        <form
          className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]"
          onSubmit={invite}
        >
          <input
            aria-label="Teammate email"
            className="h-12 rounded-2xl border border-border bg-background px-4 text-sm"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@example.org"
            required
            type="email"
            value={email}
          />
          <select
            aria-label="Organization role"
            className="h-12 rounded-2xl border border-border bg-background px-4 text-sm"
            onChange={(event) => setRole(event.target.value as typeof role)}
            value={role}
          >
            {roles.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button disabled={saving === "invite"} type="submit">
            {saving === "invite" ? "Sending…" : "Send invite"}
          </Button>
        </form>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {roles.map(([value, label, description]) => (
            <div className="rounded-2xl bg-muted/60 p-3" key={value}>
              <p className="text-xs font-black">{label}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {error ? (
        <p
          className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="rounded-2xl bg-kondo-mint px-4 py-3 text-sm font-semibold text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
          role="status"
        >
          {success}
        </p>
      ) : null}

      <section className="rounded-4xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-black">Active team · {members.length}</h2>
          <label className="flex h-11 items-center gap-2 rounded-2xl border border-border bg-background px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="sr-only">Search team</span>
            <input
              className="min-w-0 bg-transparent text-sm outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search team"
              value={query}
            />
          </label>
        </div>
        <div className="mt-5 grid gap-3">
          {filtered.map((member) => {
            const isOwner = member.role === "OWNER";
            const self = member.userId === currentUserId;
            const canEdit =
              !isOwner &&
              !self &&
              (currentRole === "OWNER" ||
                (currentRole === "ADMIN" && member.role !== "ADMIN"));
            return (
              <article
                className="flex flex-col gap-3 rounded-3xl border border-border p-4 sm:flex-row sm:items-center"
                key={member.userId}
              >
                <Avatar
                  className="h-11 w-11"
                  firstName={member.user.firstName}
                  lastName={member.user.lastName}
                  mediaId={member.user.avatarMediaId}
                />
                <div className="min-w-0">
                  <p className="truncate font-black">
                    {member.user.firstName} {member.user.lastName}
                    {self ? " (you)" : ""}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.user.email} · joined{" "}
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:ml-auto">
                  {canEdit ? (
                    <select
                      aria-label={`Role for ${member.user.firstName}`}
                      className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold"
                      disabled={saving === member.userId}
                      onChange={(event) =>
                        changeRole(member.userId, event.target.value)
                      }
                      value={member.role}
                    >
                      {roles.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-black capitalize">
                      {member.role.toLowerCase()}
                    </span>
                  )}
                  {canEdit ? (
                    <Button
                      aria-label={`Remove ${member.user.firstName}`}
                      disabled={saving === member.userId}
                      onClick={() => removeMember(member.userId)}
                      size="icon"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-4xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3">
          <UserRoundCog className="h-5 w-5 text-kondo-green" />
          <h2 className="text-xl font-black">
            Pending invitations · {invitations.length}
          </h2>
        </div>
        <div className="mt-4 grid gap-3">
          {invitations.map((invitation) => (
            <div
              className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-4 sm:flex-row sm:items-center"
              key={invitation.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">
                  {invitation.emailNormalized}
                </p>
                <p className="text-xs text-muted-foreground">
                  expires {new Date(invitation.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <select
                aria-label={`Pending role for ${invitation.emailNormalized}`}
                className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold"
                disabled={saving === invitation.id}
                onChange={(event) =>
                  setInvitations((current) =>
                    current.map((item) =>
                      item.id === invitation.id
                        ? { ...item, intendedRole: event.target.value }
                        : item,
                    ),
                  )
                }
                value={invitation.intendedRole}
              >
                {roles.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 sm:ml-auto">
                <Button
                  disabled={saving === invitation.id}
                  onClick={() => resendInvitation(invitation.id)}
                  size="sm"
                  variant="secondary"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Resend
                </Button>
                <Button
                  disabled={saving === invitation.id}
                  onClick={() => cancelInvitation(invitation.id)}
                  size="sm"
                  variant="ghost"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ))}
          {!invitations.length ? (
            <p className="py-5 text-sm text-muted-foreground">
              No invitation is waiting for a response.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
