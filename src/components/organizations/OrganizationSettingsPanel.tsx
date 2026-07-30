"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowRightLeft, LogOut, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ORGANIZATION_CAPABILITIES } from "@/lib/organization-capabilities";
import { cn } from "@/lib/utils";

type Transfer = {
  id: string;
  initiatedByUserId: string;
  targetUserId: string;
  expiresAt: Date | string;
  targetUser: { firstName: string; lastName: string };
};

export function OrganizationSettingsPanel({
  organization,
  currentUserId,
  role,
  canManageCapabilities,
  canTransfer,
  canLeave,
  canArchive,
  eligibleMembers,
  pendingTransfers,
}: {
  organization: {
    id: string;
    slug: string;
    publicName: string;
    capabilities: Array<{ key: string; status: string }>;
  };
  currentUserId: string;
  role: string;
  canManageCapabilities: boolean;
  canTransfer: boolean;
  canLeave: boolean;
  canArchive: boolean;
  eligibleMembers: Array<{
    userId: string;
    user: { firstName: string; lastName: string };
  }>;
  pendingTransfers: Transfer[];
}) {
  const router = useRouter();
  const [capabilities, setCapabilities] = useState(
    organization.capabilities
      .filter((capability) => capability.status === "ENABLED")
      .map((capability) => capability.key),
  );
  const [targetUserId, setTargetUserId] = useState("");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function request(
    key: string,
    url: string,
    init: RequestInit,
    successMessage: string,
  ) {
    setLoading(key);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(url, {
        credentials: "include",
        ...init,
      });
      const data =
        response.status === 204
          ? null
          : await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          data?.error ?? "The organization action could not be completed.",
        );
        return false;
      }
      setSuccess(successMessage);
      router.refresh();
      return true;
    } catch {
      setError("Kondo could not reach the server.");
      return false;
    } finally {
      setLoading("");
    }
  }

  async function saveCapabilities() {
    await request(
      "capabilities",
      `/api/organizations/${organization.id}/capabilities`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capabilities }),
      },
      "Activity areas saved.",
    );
  }

  async function startTransfer() {
    if (!targetUserId) return;
    if (
      !window.confirm(
        "Offer ownership to this active member? You will become an Administrator only after they accept.",
      )
    )
      return;
    await request(
      "transfer",
      `/api/organizations/${organization.id}/ownership-transfer`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, confirm: true }),
      },
      "Ownership transfer request sent.",
    );
  }

  async function decideTransfer(
    transferId: string,
    action: "ACCEPT" | "DECLINE" | "CANCEL",
  ) {
    await request(
      transferId,
      `/api/organization-ownership-transfers/${transferId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      },
      `Ownership transfer ${action.toLowerCase()}ed.`,
    );
  }

  async function leave() {
    if (
      !window.confirm(
        "Leave this organization? Your personal Kondo account will remain unchanged.",
      )
    )
      return;
    const ok = await request(
      "leave",
      `/api/organizations/${organization.id}/leave`,
      { method: "POST" },
      "You left the organization.",
    );
    if (ok) window.location.assign("/settings/organizations");
  }

  async function archive() {
    if (
      !window.confirm(
        "Archive this organization? Data and audit history will be retained, but normal workspace access will stop.",
      )
    )
      return;
    const ok = await request(
      "archive",
      `/api/organizations/${organization.id}/archive`,
      { method: "POST" },
      "Organization archived.",
    );
    if (ok) window.location.assign("/settings/organizations");
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-4xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-black">Activity areas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Disabling an area never deletes future published data.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {ORGANIZATION_CAPABILITIES.map((capability) => {
            const selected = capabilities.includes(capability.key);
            const Icon = capability.icon;
            return (
              <button
                aria-pressed={selected}
                className={cn(
                  "rounded-3xl border p-4 text-left transition",
                  selected
                    ? "border-kondo-green bg-kondo-mint dark:bg-emerald-400/10"
                    : "border-border bg-background",
                  !canManageCapabilities && "cursor-not-allowed opacity-70",
                )}
                disabled={!canManageCapabilities}
                key={capability.key}
                onClick={() =>
                  setCapabilities((current) =>
                    selected
                      ? current.filter((key) => key !== capability.key)
                      : [...current, capability.key],
                  )
                }
                type="button"
              >
                <Icon className="h-5 w-5 text-kondo-green" />
                <span className="mt-3 block text-sm font-black">
                  {capability.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {capability.description}
                </span>
              </button>
            );
          })}
        </div>
        {canManageCapabilities ? (
          <Button
            className="mt-5"
            disabled={loading === "capabilities"}
            onClick={saveCapabilities}
          >
            <Save className="h-4 w-4" />
            {loading === "capabilities" ? "Saving…" : "Save activity areas"}
          </Button>
        ) : null}
      </section>

      <section className="rounded-4xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="h-5 w-5 text-kondo-green" />
          <div>
            <h2 className="text-xl font-black">Ownership</h2>
            <p className="text-sm text-muted-foreground">
              Current role: {role.toLowerCase()}
            </p>
          </div>
        </div>
        {canTransfer ? (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <select
              aria-label="New organization owner"
              className="h-12 flex-1 rounded-2xl border border-border bg-background px-4 text-sm"
              onChange={(event) => setTargetUserId(event.target.value)}
              value={targetUserId}
            >
              <option value="">Select an active member</option>
              {eligibleMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.firstName} {member.user.lastName}
                </option>
              ))}
            </select>
            <Button
              disabled={!targetUserId || loading === "transfer"}
              onClick={startTransfer}
              variant="secondary"
            >
              Offer ownership
            </Button>
          </div>
        ) : null}
        {pendingTransfers.map((transfer) => {
          const isTarget = transfer.targetUserId === currentUserId;
          return (
            <div className="mt-4 rounded-2xl bg-muted/60 p-4" key={transfer.id}>
              <p className="text-sm font-bold">
                Ownership offered to {transfer.targetUser.firstName}{" "}
                {transfer.targetUser.lastName}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Expires {new Date(transfer.expiresAt).toLocaleString()}
              </p>
              <div className="mt-3 flex gap-2">
                {isTarget ? (
                  <>
                    <Button
                      disabled={loading === transfer.id}
                      onClick={() => decideTransfer(transfer.id, "ACCEPT")}
                      size="sm"
                    >
                      Accept ownership
                    </Button>
                    <Button
                      disabled={loading === transfer.id}
                      onClick={() => decideTransfer(transfer.id, "DECLINE")}
                      size="sm"
                      variant="ghost"
                    >
                      Decline
                    </Button>
                  </>
                ) : (
                  <Button
                    disabled={loading === transfer.id}
                    onClick={() => decideTransfer(transfer.id, "CANCEL")}
                    size="sm"
                    variant="ghost"
                  >
                    Cancel transfer
                  </Button>
                )}
              </div>
            </div>
          );
        })}
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

      <section className="rounded-4xl border border-destructive/25 bg-card p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <h2 className="text-xl font-black">Danger zone</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          These actions change organization access only. Personal Kondo accounts
          remain independent.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {canLeave ? (
            <Button
              disabled={loading === "leave"}
              onClick={leave}
              variant="secondary"
            >
              <LogOut className="h-4 w-4" /> Leave organization
            </Button>
          ) : null}
          {canArchive ? (
            <Button
              disabled={loading === "archive"}
              onClick={archive}
              variant="danger"
            >
              Archive organization
            </Button>
          ) : null}
          {!canLeave && !canArchive ? (
            <p className="text-xs text-muted-foreground">
              No destructive action is available for your current role.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
