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
import { PushNotificationControl } from "@/components/features/settings/PushNotificationControl";

type Preferences = {
  notificationMessages: boolean;
  notificationComments: boolean;
  notificationMarketplace: boolean;
  notificationHousing: boolean;
  notificationAnnouncements: boolean;
  notificationCommunity: boolean;
  notificationMeet: boolean;
  notificationAcademic: boolean;
  notificationRecommendations: boolean;
  notificationFriends: boolean;
  notificationEvents: boolean;
  notificationTransfers: boolean;
  notificationUniversity: boolean;
  notificationSecurity: boolean;
  notificationMarketing: boolean;
  notificationSounds: boolean;
  notificationHaptics: boolean;
  emailDigest: "NEVER" | "DAILY" | "WEEKLY";
};

type CategoryToggle = {
  key: Exclude<keyof Preferences, "emailDigest">;
  label: string;
  description: string;
  /** Rendered locked: delivery ignores the stored value for this category. */
  alwaysOn?: boolean;
};

const toggles: CategoryToggle[] = [
  {
    key: "notificationFriends" as const,
    label: "Friends",
    description: "Connection requests and accepted requests.",
  },
  {
    key: "notificationMessages" as const,
    label: "Messages",
    description: "Replies and new direct conversations.",
  },
  {
    key: "notificationEvents" as const,
    label: "Events",
    description: "New events and useful reminders before they begin.",
  },
  {
    key: "notificationComments" as const,
    label: "Comments and replies",
    description: "Useful responses to your community and Q&A activity.",
  },
  {
    key: "notificationTransfers" as const,
    label: "Payments and transfers",
    description: "Receipts and transfer status when these features are active.",
  },
  {
    key: "notificationUniversity" as const,
    label: "University",
    description: "Official university updates, opportunities and scholarships.",
  },
  {
    key: "notificationSecurity" as const,
    label: "Security",
    description:
      "Account, device and safety alerts. These are always delivered so you never miss a sign-in you did not make.",
    alwaysOn: true,
  },
  {
    key: "notificationMarketing" as const,
    label: "Kondo news",
    description: "Optional product news and carefully selected announcements.",
  },
  {
    key: "notificationMarketplace" as const,
    label: "Marketplace",
    description: "Relevant updates about your listings and contacts.",
  },
  {
    key: "notificationHousing" as const,
    label: "Housing",
    description:
      "Listing reviews, inquiries, housing requests and roommate connections.",
  },
  {
    key: "notificationCommunity" as const,
    label: "Communities",
    description: "Useful discussions and activity from communities you joined.",
  },
  {
    key: "notificationMeet" as const,
    label: "Meet",
    description: "Meaningful student connections matching your preferences.",
  },
  {
    key: "notificationAcademic" as const,
    label: "Academic reminders",
    description: "Classes, timetable analysis and other Student Hub actions.",
  },
  {
    key: "notificationRecommendations" as const,
    label: "Personalized recommendations",
    description: "Limited scholarships and nearby Marketplace suggestions.",
  },
  {
    key: "notificationAnnouncements" as const,
    label: "Community announcements",
    description: "Important staff and platform announcements.",
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
      notificationHousing: values.has("notificationHousing"),
      notificationAnnouncements: values.has("notificationAnnouncements"),
      notificationCommunity: values.has("notificationCommunity"),
      notificationMeet: values.has("notificationMeet"),
      notificationAcademic: values.has("notificationAcademic"),
      notificationRecommendations: values.has("notificationRecommendations"),
      notificationFriends: values.has("notificationFriends"),
      notificationEvents: values.has("notificationEvents"),
      notificationTransfers: values.has("notificationTransfers"),
      notificationUniversity: values.has("notificationUniversity"),
      // Locked in the form, so the checkbox never submits a value.
      notificationSecurity: true,
      notificationMarketing: values.has("notificationMarketing"),
      notificationSounds: values.has("notificationSounds"),
      notificationHaptics: values.has("notificationHaptics"),
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
    <div className="space-y-6">
      <PushNotificationControl />
      <Card>
        <form
          className="space-y-5"
          onChange={() => {
            setIsDirty(true);
            if (saveState === "success") setSaveState("idle");
          }}
          onSubmit={save}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {toggles.map(({ key, label, description, alwaysOn }) => (
              <label
                className="flex items-start gap-3 rounded-2xl border border-border bg-background/50 p-4 transition hover:border-kondo-green/35"
                key={key}
              >
                <input
                  checked={alwaysOn ? true : undefined}
                  className="peer sr-only"
                  defaultChecked={alwaysOn ? undefined : preferences[key]}
                  disabled={alwaysOn}
                  name={key}
                  readOnly={alwaysOn}
                  type="checkbox"
                />
                <span className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-muted shadow-inner transition peer-checked:bg-kondo-green peer-disabled:opacity-60 peer-focus-visible:ring-2 peer-focus-visible:ring-kondo-green peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5" />
                <span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-kondo-ink dark:text-white">
                      {label}
                    </span>
                    {alwaysOn ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                        Always on
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                    {description}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <fieldset className="rounded-2xl border border-border p-4">
            <legend className="px-2 text-sm font-black text-foreground">
              Feedback
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  key: "notificationSounds" as const,
                  label: "In-app sound",
                  description: "Play Kondo’s subtle two-note notification cue.",
                },
                {
                  key: "notificationHaptics" as const,
                  label: "Haptic feedback",
                  description:
                    "Use a light vibration when the device supports it.",
                },
              ].map(({ key, label, description }) => (
                <label className="flex items-start gap-3 p-2" key={key}>
                  <input
                    className="mt-1 h-4 w-4 accent-emerald-700"
                    defaultChecked={preferences[key]}
                    name={key}
                    type="checkbox"
                  />
                  <span>
                    <span className="block text-sm font-bold">{label}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
            <span className="font-bold text-kondo-ink dark:text-white">
              Email digest
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Save your preferred summary frequency. Delivery is activated by
              the notification service in Module 8.
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
    </div>
  );
}
