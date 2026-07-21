"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Template = {
  key: string;
  type: string;
  titleTemplate: string;
  bodyTemplate: string | null;
  isActive: boolean;
  version: number;
  allowedTokens: readonly string[];
};

type Diagnostics = {
  counts: {
    pending: number;
    processing: number;
    failed: number;
    skipped: number;
    delivered: number;
  };
  templates: Template[];
  announcements: Array<{
    id: string;
    title: string;
    status: string;
    recipientCount: number;
    audience: unknown;
    queuedAt: string;
  }>;
  recentJobs: Array<{
    id: string;
    type: string;
    templateKey: string;
    status: string;
    attempts: number;
    lastErrorCode: string | null;
    createdAt: string;
  }>;
};

function announcementAudienceLabel(value: unknown) {
  if (!value || typeof value !== "object") return "All users";
  const audience = value as { label?: unknown; type?: unknown };
  if (typeof audience.label === "string") return audience.label;
  return typeof audience.type === "string" ? audience.type : "All users";
}

export function NotificationAdminPanel({
  diagnostics,
  canManage,
  audienceOptions,
}: {
  diagnostics: Diagnostics;
  canManage: boolean;
  audienceOptions: {
    cities: Array<{ id: string; name: string }>;
    communities: Array<{ id: string; name: string }>;
    universities: Array<{ id: string; name: string }>;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function announce(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const audienceValue = String(values.get("audience") ?? "ALL");
    const [audienceType, audienceId] = audienceValue.split(":", 2);
    const audience =
      audienceType === "ALL"
        ? { type: "ALL" }
        : { type: audienceType, id: audienceId };
    if (!window.confirm("Queue this announcement for the selected audience?")) {
      return;
    }
    setPending(true);
    setFeedback("");
    const response = await fetch("/api/admin/notifications", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: values.get("title"),
        body: values.get("body"),
        href: String(values.get("href") ?? "").trim() || null,
        audience,
      }),
    }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setPending(false);
    if (!response?.ok) {
      setFeedback(result?.error ?? "Announcement could not be queued.");
      return;
    }
    form.reset();
    setFeedback("Announcement queued for asynchronous delivery.");
    router.refresh();
  }

  async function saveTemplate(
    event: FormEvent<HTMLFormElement>,
    template: Template,
  ) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true);
    setFeedback("");
    const response = await fetch(
      `/api/admin/notifications/templates/${encodeURIComponent(template.key)}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleTemplate: values.get("titleTemplate"),
          bodyTemplate: String(values.get("bodyTemplate") ?? "").trim() || null,
          isActive: values.has("isActive"),
          expectedVersion: template.version,
        }),
      },
    ).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setPending(false);
    if (!response?.ok) {
      setFeedback(result?.error ?? "Template could not be saved.");
      return;
    }
    setFeedback(`${template.key} saved.`);
    router.refresh();
  }

  const stats = [
    ["Pending", diagnostics.counts.pending],
    ["Processing", diagnostics.counts.processing],
    ["Delivered", diagnostics.counts.delivered],
    ["Skipped", diagnostics.counts.skipped],
    ["Failed", diagnostics.counts.failed],
  ];

  return (
    <div className="mt-7 space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(([label, value]) => (
          <Card key={label}>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-3xl font-black text-kondo-ink dark:text-white">
              {value}
            </p>
          </Card>
        ))}
      </section>

      {canManage ? (
        <Card>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10 dark:text-emerald-300">
              <Send className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-black text-kondo-ink dark:text-white">
                Product announcement
              </h2>
              <p className="text-sm text-muted-foreground">
                Queue one useful in-app announcement for active members.
              </p>
            </div>
          </div>
          <form className="mt-5 grid gap-4" onSubmit={announce}>
            <input
              className="rounded-2xl border border-slate-200 bg-transparent px-4 py-3 text-sm outline-none focus:border-kondo-green dark:border-white/10"
              maxLength={160}
              minLength={3}
              name="title"
              placeholder="Announcement title"
              required
            />
            <textarea
              className="min-h-24 rounded-2xl border border-slate-200 bg-transparent px-4 py-3 text-sm outline-none focus:border-kondo-green dark:border-white/10"
              maxLength={280}
              minLength={3}
              name="body"
              placeholder="Useful announcement"
              required
            />
            <label className="text-xs font-bold text-muted-foreground">
              Audience
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-sm dark:border-white/10"
                defaultValue="ALL"
                name="audience"
              >
                <option value="ALL">All active users</option>
                {audienceOptions.cities.map((city) => (
                  <option key={`city-${city.id}`} value={`CITY:${city.id}`}>
                    City · {city.name}
                  </option>
                ))}
                {audienceOptions.communities.map((community) => (
                  <option
                    key={`community-${community.id}`}
                    value={`COMMUNITY:${community.id}`}
                  >
                    Community · {community.name}
                  </option>
                ))}
                {audienceOptions.universities.map((university) => (
                  <option
                    key={`university-${university.id}`}
                    value={`UNIVERSITY:${university.id}`}
                  >
                    University · {university.name}
                  </option>
                ))}
              </select>
            </label>
            <input
              className="rounded-2xl border border-slate-200 bg-transparent px-4 py-3 text-sm outline-none focus:border-kondo-green dark:border-white/10"
              maxLength={500}
              name="href"
              placeholder="/student-hub (optional internal link)"
            />
            <Button disabled={pending} type="submit">
              <Send className="h-4 w-4" />
              Queue announcement
            </Button>
          </form>
        </Card>
      ) : null}

      <section>
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-kondo-green" />
          <h2 className="font-black text-kondo-ink dark:text-white">
            Templates
          </h2>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {diagnostics.templates.map((template) => (
            <Card key={template.key}>
              <form
                className="space-y-4"
                onSubmit={(event) => saveTemplate(event, template)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-kondo-ink dark:text-white">
                      {template.key}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {template.type} · version {template.version}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <input
                      className="accent-emerald-700"
                      defaultChecked={template.isActive}
                      disabled={!canManage}
                      name="isActive"
                      type="checkbox"
                    />
                    Active
                  </label>
                </div>
                <label className="block text-xs font-bold text-muted-foreground">
                  Title
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-kondo-green dark:border-white/10"
                    defaultValue={template.titleTemplate}
                    disabled={!canManage}
                    maxLength={160}
                    minLength={3}
                    name="titleTemplate"
                    required
                  />
                </label>
                <label className="block text-xs font-bold text-muted-foreground">
                  Body
                  <textarea
                    className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-kondo-green dark:border-white/10"
                    defaultValue={template.bodyTemplate ?? ""}
                    disabled={!canManage}
                    maxLength={280}
                    name="bodyTemplate"
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  Allowed tokens:{" "}
                  {template.allowedTokens.length
                    ? template.allowedTokens
                        .map((token) => `{{${token}}}`)
                        .join(", ")
                    : "none"}
                </p>
                {canManage ? (
                  <Button disabled={pending} size="sm" type="submit">
                    <Save className="h-4 w-4" /> Save template
                  </Button>
                ) : null}
              </form>
            </Card>
          ))}
        </div>
      </section>

      {feedback ? (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm text-muted-foreground dark:bg-white/5 dark:text-muted-foreground">
          {feedback}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="font-black text-kondo-ink dark:text-white">
            Recent announcements
          </h2>
          <div className="mt-4 space-y-3">
            {diagnostics.announcements.map((announcement) => (
              <div
                className="rounded-2xl border border-slate-200 p-4 dark:border-white/10"
                key={announcement.id}
              >
                <p className="font-bold text-kondo-ink dark:text-white">
                  {announcement.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {announcement.status} · {announcement.recipientCount} targets
                  · {announcementAudienceLabel(announcement.audience)}
                </p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-black text-kondo-ink dark:text-white">
            Recent delivery jobs
          </h2>
          <div className="mt-4 space-y-3">
            {diagnostics.recentJobs.map((job) => (
              <div
                className="rounded-2xl border border-slate-200 p-4 dark:border-white/10"
                key={job.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-kondo-ink dark:text-white">
                    {job.templateKey}
                  </p>
                  <span className="text-xs font-black text-muted-foreground">
                    {job.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {job.type} · attempt {job.attempts}
                  {job.lastErrorCode ? ` · ${job.lastErrorCode}` : ""}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
