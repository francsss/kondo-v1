"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Audience = "PUBLIC" | "MEMBERS" | "PRIVATE";
type PrivacyPreferences = {
  profileAudience: Audience;
  locationAudience: Audience;
  educationAudience: Audience;
  languagesAudience: Audience;
  communitiesAudience: Audience;
  activityAudience: Audience;
  marketplaceAudience: Audience;
};

const fields: Array<{
  key: keyof PrivacyPreferences;
  label: string;
  description: string;
}> = [
  {
    key: "profileAudience",
    label: "Whole profile",
    description: "The main gate checked before any profile section.",
  },
  {
    key: "locationAudience",
    label: "Location",
    description: "Country of origin and current study city.",
  },
  {
    key: "educationAudience",
    label: "Education",
    description: "University, program and study level.",
  },
  {
    key: "languagesAudience",
    label: "Languages",
    description: "Languages listed on your profile.",
  },
  {
    key: "communitiesAudience",
    label: "Communities",
    description: "Only communities the viewer may already access.",
  },
  {
    key: "activityAudience",
    label: "Activity",
    description: "Published posts and questions visible to the viewer.",
  },
  {
    key: "marketplaceAudience",
    label: "Marketplace",
    description: "Your active marketplace listings.",
  },
];

export function PrivacySettings({
  preferences,
}: {
  preferences: PrivacyPreferences;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const payload = Object.fromEntries(
      fields.map(({ key }) => [key, values.get(key)]),
    );
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error ?? "Privacy preferences were not saved.");
      }
      setFeedback("Privacy preferences saved.");
      router.refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Privacy preferences were not saved.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <form className="space-y-5" onSubmit={save}>
        {fields.map(({ key, label, description }) => (
          <label
            className="grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-[1fr_180px] sm:items-center dark:border-white/10"
            key={key}
          >
            <span>
              <span className="block font-bold text-kondo-ink dark:text-white">
                {label}
              </span>
              <span className="mt-1 block text-sm text-slate-500 dark:text-slate-300">
                {description}
              </span>
            </span>
            <select
              className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm font-bold outline-none focus:border-kondo-green dark:border-white/10"
              defaultValue={preferences[key]}
              name={key}
            >
              <option value="PUBLIC">Anyone</option>
              <option value="MEMBERS">Kondo members</option>
              <option value="PRIVATE">Only me</option>
            </select>
          </label>
        ))}
        <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-500 dark:bg-white/5 dark:text-slate-300">
          Your email and phone number remain private regardless of these
          selections. Private-community content is never revealed by a profile
          preference.
        </p>
        {feedback ? (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            {feedback}
          </p>
        ) : null}
        <Button disabled={pending} type="submit">
          <Save className="h-4 w-4" />
          {pending ? "Saving…" : "Save privacy"}
        </Button>
      </form>
    </Card>
  );
}
