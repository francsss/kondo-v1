"use client";

import { FormEvent, useState } from "react";
import { Save } from "lucide-react";
import {
  SaveButtonLabel,
  SaveFeedback,
  type SaveState,
} from "@/components/forms/SaveFeedback";
import { UnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Preferences = {
  notificationMessages: boolean;
  notificationComments: boolean;
  notificationMarketplace: boolean;
  notificationAnnouncements: boolean;
  emailDigest: "NEVER" | "DAILY" | "WEEKLY";
};

const toggles = [
  {
    key: "notificationMessages" as const,
    label: "Messages",
    description: "Replies and new direct conversations.",
  },
  {
    key: "notificationComments" as const,
    label: "Comments and replies",
    description: "Useful responses to your community and Q&A activity.",
  },
  {
    key: "notificationMarketplace" as const,
    label: "Marketplace",
    description: "Relevant updates about your listings and contacts.",
  },
  {
    key: "notificationAnnouncements" as const,
    label: "Community announcements",
    description: "Important updates from communities you joined.",
  },
];

export function NotificationSettings({
  preferences,
}: {
  preferences: Preferences;
}) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [feedback, setFeedback] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const payload = {
      notificationMessages: values.has("notificationMessages"),
      notificationComments: values.has("notificationComments"),
      notificationMarketplace: values.has("notificationMarketplace"),
      notificationAnnouncements: values.has("notificationAnnouncements"),
      emailDigest: values.get("emailDigest"),
    };
    setSaveState("saving");
    setFeedback("");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          result.error ?? "Notification preferences were not saved.",
        );
      }
      setSaveState("success");
      setFeedback("Notification preferences saved to the database.");
      setIsDirty(false);
    } catch (error) {
      setSaveState("error");
      setFeedback(
        error instanceof Error
          ? error.message
          : "Notification preferences were not saved.",
      );
    }
  }

  return (
    <Card>
      <form
        className="space-y-5"
        onChange={() => {
          setIsDirty(true);
          if (saveState === "success") setSaveState("idle");
        }}
        onSubmit={save}
      >
        {toggles.map(({ key, label, description }) => (
          <label
            className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 dark:border-white/10"
            key={key}
          >
            <input
              className="mt-1 h-4 w-4 accent-emerald-700"
              defaultChecked={preferences[key]}
              name={key}
              type="checkbox"
            />
            <span>
              <span className="block font-bold text-kondo-ink dark:text-white">
                {label}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {description}
              </span>
            </span>
          </label>
        ))}
        <label className="block rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
          <span className="font-bold text-kondo-ink dark:text-white">
            Email digest
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Save your preferred summary frequency. Delivery is activated by the
            notification service in Module 8.
          </span>
          <select
            className="mt-3 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold text-card-foreground outline-none focus:border-primary"
            defaultValue={preferences.emailDigest}
            name="emailDigest"
          >
            <option value="NEVER">No email digest</option>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
          </select>
        </label>
        <Button disabled={saveState === "saving" || !isDirty} type="submit">
          {saveState === "idle" || saveState === "error" ? (
            <Save className="h-4 w-4" />
          ) : null}
          <SaveButtonLabel idleLabel="Save notifications" state={saveState} />
        </Button>
        <SaveFeedback message={feedback} state={saveState} />
        <UnsavedChangesGuard isDirty={isDirty} />
      </form>
    </Card>
  );
}
