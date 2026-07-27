"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Save } from "lucide-react";
import {
  SaveButtonLabel,
  SaveFeedback,
  type SaveState,
} from "@/components/forms/SaveFeedback";
import { UnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { AccountRequestPanel } from "@/components/features/profile/AccountRequestPanel";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { uploadMediaFile } from "@/lib/client-media";

type Audience = "PUBLIC" | "MEMBERS" | "PRIVATE";
type ProfileSettings = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string | null;
  bio: string | null;
  phone: string | null;
  avatarMediaId: string | null;
  profileAudience: Audience;
  locationAudience: Audience;
  educationAudience: Audience;
  languagesAudience: Audience;
  communitiesAudience: Audience;
  activityAudience: Audience;
  marketplaceAudience: Audience;
  accountRequests: Array<{
    id: string;
    type: "DATA_EXPORT" | "ACCOUNT_DELETION";
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "REJECTED" | "CANCELLED";
    reason: string | null;
    responseNote: string | null;
    version: number;
    createdAt: string;
  }>;
};

export function ProfileEditor({ profile }: { profile: ProfileSettings }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [feedback, setFeedback] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setSaveState("saving");
    setFeedback("");
    try {
      let avatarMediaId: string | null | undefined;
      if (removeAvatar) avatarMediaId = null;
      if (file) {
        avatarMediaId = await uploadMediaFile(file, {
          purpose: "PROFILE_AVATAR",
          altText: String(values.get("avatarAlt") ?? "").trim(),
          replacesId: profile.avatarMediaId ?? undefined,
        });
      }
      const payload = {
        firstName: values.get("firstName"),
        lastName: values.get("lastName"),
        username: String(values.get("username") ?? "").trim() || null,
        bio: String(values.get("bio") ?? "").trim() || null,
        phone: String(values.get("phone") ?? "").trim() || null,
        ...(avatarMediaId !== undefined ? { avatarMediaId } : {}),
        profileAudience: values.get("profileAudience"),
        locationAudience: values.get("locationAudience"),
        educationAudience: values.get("educationAudience"),
        languagesAudience: values.get("languagesAudience"),
        communitiesAudience: values.get("communitiesAudience"),
        activityAudience: values.get("activityAudience"),
        marketplaceAudience: values.get("marketplaceAudience"),
      };
      const response = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error ?? "Profile could not be saved.");
      }
      setSaveState("success");
      setFeedback("Profile saved to the database.");
      setIsDirty(false);
      setFile(null);
      setRemoveAvatar(false);
      router.refresh();
    } catch (error) {
      setSaveState("error");
      setFeedback(
        error instanceof Error ? error.message : "Profile could not be saved.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <form
          className="space-y-7"
          onChange={() => {
            setIsDirty(true);
            if (saveState === "success") setSaveState("idle");
          }}
          onSubmit={save}
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar
              className="h-24 w-24 text-2xl"
              firstName={profile.firstName}
              lastName={profile.lastName}
              mediaId={removeAvatar ? null : profile.avatarMediaId}
              seed={profile.id}
            />
            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-kondo-ink transition hover:border-kondo-green dark:border-white/10 dark:text-white">
                <ImagePlus className="h-4 w-4" />
                Choose avatar
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setRemoveAvatar(false);
                    setIsDirty(true);
                  }}
                  type="file"
                />
              </label>
              {file ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {file.name}
                </p>
              ) : null}
              {profile.avatarMediaId ? (
                <button
                  className="mt-2 block text-xs font-bold text-red-600"
                  onClick={() => {
                    setRemoveAvatar(true);
                    setFile(null);
                    setIsDirty(true);
                  }}
                  type="button"
                >
                  Remove current avatar
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              defaultValue={profile.firstName}
              label="First name"
              name="firstName"
              required
            />
            <Field
              defaultValue={profile.lastName}
              label="Last name"
              name="lastName"
              required
            />
            <Field
              defaultValue={profile.username ?? ""}
              label="Username"
              name="username"
              placeholder="your.name"
            />
            <Field
              defaultValue={profile.phone ?? ""}
              label="Phone (always private)"
              name="phone"
              placeholder="+86 …"
            />
          </div>
          <label className="block">
            <span className="text-xs font-bold text-muted-foreground">Bio</span>
            <textarea
              className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-transparent px-4 py-3 text-sm outline-none focus:border-kondo-green dark:border-white/10"
              defaultValue={profile.bio ?? ""}
              maxLength={280}
              name="bio"
            />
          </label>
          <Field
            defaultValue={`Portrait of ${profile.firstName} ${profile.lastName}`}
            label="Avatar alt text"
            name="avatarAlt"
            required={Boolean(file)}
          />

          <div>
            <h2 className="font-black text-kondo-ink dark:text-white">
              Profile visibility
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Email and phone are always private. Choose who can see each
              student-facing section.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <AudienceField
                defaultValue={profile.profileAudience}
                label="Whole profile"
                name="profileAudience"
              />
              <AudienceField
                defaultValue={profile.locationAudience}
                label="Location"
                name="locationAudience"
              />
              <AudienceField
                defaultValue={profile.educationAudience}
                label="Education"
                name="educationAudience"
              />
              <AudienceField
                defaultValue={profile.languagesAudience}
                label="Languages"
                name="languagesAudience"
              />
              <AudienceField
                defaultValue={profile.communitiesAudience}
                label="Communities"
                name="communitiesAudience"
              />
              <AudienceField
                defaultValue={profile.activityAudience}
                label="Posts and Q&A"
                name="activityAudience"
              />
              <AudienceField
                defaultValue={profile.marketplaceAudience}
                label="Marketplace"
                name="marketplaceAudience"
              />
            </div>
          </div>
          <Button disabled={saveState === "saving" || !isDirty} type="submit">
            {saveState === "idle" || saveState === "error" ? (
              <Save className="h-4 w-4" />
            ) : null}
            <SaveButtonLabel idleLabel="Save profile" state={saveState} />
          </Button>
        </form>
      </Card>

      <SaveFeedback message={feedback} state={saveState} />
      <UnsavedChangesGuard isDirty={isDirty} />

      <AccountRequestPanel requests={profile.accountRequests} />
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <input
        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-sm outline-none focus:border-kondo-green dark:border-white/10"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}

function AudienceField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: Audience;
}) {
  return (
    <label>
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <select
        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-sm dark:border-white/10"
        defaultValue={defaultValue}
        name={name}
      >
        <option value="PUBLIC">Everyone</option>
        <option value="MEMBERS">Kondo members</option>
        <option value="PRIVATE">Only me</option>
      </select>
    </label>
  );
}
