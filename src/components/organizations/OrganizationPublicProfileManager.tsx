"use client";

import type {
  OrganizationContactType,
  OrganizationContactVisibility,
  OrganizationPublicProfileStatus,
} from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  Globe2,
  ImagePlus,
  Lock,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";
import { uploadMediaFile } from "@/lib/client-media";

type Contact = {
  id?: string;
  type: OrganizationContactType;
  label: string;
  value: string;
  visibility: OrganizationContactVisibility;
};

type GalleryItem = {
  id: string;
  mediaId: string;
  caption: string | null;
  altText: string;
  visibility: OrganizationContactVisibility;
  sortOrder: number;
};

type Readiness = {
  isReady: boolean;
  missingRequirements: Array<{ key: string; message: string }>;
  blockingReasons: Array<{ key: string; message: string }>;
  warnings: Array<{ key: string; message: string }>;
  profileCompletionSummary: {
    completed: number;
    total: number;
    percentage: number;
  };
};

type ManagedOrganization = {
  id: string;
  slug: string;
  publicName: string;
  tagline: string | null;
  shortDescription: string | null;
  extendedDescription: string | null;
  publicAddress: string | null;
  serviceAreas: string[];
  supportedLanguages: string[];
  publicProfileStatus: OrganizationPublicProfileStatus;
  representationConfirmed: boolean;
  publishedAt: string | null;
  unpublishedAt: string | null;
  lastPublicUpdateAt: string | null;
  contactChannels: Array<{
    id: string;
    type: OrganizationContactType;
    label: string | null;
    value: string;
    visibility: OrganizationContactVisibility;
    sortOrder: number;
  }>;
  publicMedia: GalleryItem[];
};

const CONTACT_TYPES: Array<{
  value: OrganizationContactType;
  label: string;
}> = [
  { value: "WEBSITE", label: "Website" },
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Phone" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "WECHAT", label: "WeChat" },
  { value: "OTHER", label: "Other" },
];

export function OrganizationPublicProfileManager({
  organization,
  readiness: initialReadiness,
  canPublish,
  canManageMedia,
}: {
  organization: ManagedOrganization;
  readiness: Readiness;
  canPublish: boolean;
  canManageMedia: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    tagline: organization.tagline ?? "",
    shortDescription: organization.shortDescription ?? "",
    extendedDescription: organization.extendedDescription ?? "",
    publicAddress: organization.publicAddress ?? "",
    serviceAreas: organization.serviceAreas.join(", "),
    supportedLanguages: organization.supportedLanguages.join(", "),
    representationConfirmed: organization.representationConfirmed,
  });
  const [contacts, setContacts] = useState<Contact[]>(
    organization.contactChannels.map((contact) => ({
      id: contact.id,
      type: contact.type,
      label: contact.label ?? "",
      value: contact.value,
      visibility: contact.visibility,
    })),
  );
  const [gallery, setGallery] = useState(organization.publicMedia);
  const [readiness, setReadiness] = useState(initialReadiness);
  const [status, setStatus] = useState(organization.publicProfileStatus);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [galleryAlt, setGalleryAlt] = useState("");
  const [galleryCaption, setGalleryCaption] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const publicHref = `/organizations/${organization.slug}`;
  const previewHref = `/organizations/${organization.slug}/preview`;
  const publicContacts = useMemo(
    () => contacts.filter(({ visibility }) => visibility === "PUBLIC").length,
    [contacts],
  );

  async function save() {
    if (saving) return;
    setSaving(true);
    resetNotice();
    try {
      const response = await fetch(
        `/api/organizations/${organization.id}/public-profile`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tagline: nullableValue(form.tagline),
            shortDescription: nullableValue(form.shortDescription),
            extendedDescription: nullableValue(form.extendedDescription),
            publicAddress: nullableValue(form.publicAddress),
            serviceAreas: list(form.serviceAreas),
            supportedLanguages: list(form.supportedLanguages),
            representationConfirmed: form.representationConfirmed,
            contacts: contacts
              .filter(({ value: contactValue }) => contactValue.trim())
              .map((contact) => ({
                ...(contact.id ? { id: contact.id } : {}),
                type: contact.type,
                label: value(contact.label),
                value: contact.value.trim(),
                visibility: contact.visibility,
              })),
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "The public profile could not be saved.");
        return;
      }
      setReadiness(data.readiness);
      setStatus(data.publicProfileStatus);
      setMessage("Public profile changes saved.");
      router.refresh();
    } catch {
      setError("Kondo could not reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function changePublication(action: "publish" | "unpublish") {
    if (publishing) return;
    if (
      action === "unpublish" &&
      !window.confirm(
        "Unpublish this profile? It will disappear from public pages, search and Explore, but its data will not be deleted.",
      )
    ) {
      return;
    }
    setPublishing(true);
    resetNotice();
    try {
      const response = await fetch(
        `/api/organizations/${organization.id}/public-profile/${action}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: true }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || `The profile could not be ${action}ed.`);
        return;
      }
      setStatus(data.publicProfileStatus);
      setMessage(
        action === "publish"
          ? "The organization profile is now public."
          : "The organization profile is no longer public.",
      );
      router.refresh();
    } catch {
      setError("Kondo could not reach the server. Try again.");
    } finally {
      setPublishing(false);
    }
  }

  async function uploadGalleryImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploading) return;
    if (galleryAlt.trim().length < 2) {
      setError("Add an image description before choosing the file.");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    resetNotice();
    try {
      const mediaId = await uploadMediaFile(file, {
        purpose: "ORGANIZATION_GALLERY_IMAGE",
        altText: galleryAlt.trim(),
        onProgress: setUploadProgress,
      });
      const response = await fetch(
        `/api/organizations/${organization.id}/media`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaId,
            altText: galleryAlt.trim(),
            caption: value(galleryCaption),
            visibility: "PUBLIC",
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "The uploaded image could not be attached.");
        return;
      }
      setGallery((current) => [...current, data.media]);
      setGalleryAlt("");
      setGalleryCaption("");
      setMessage("Gallery image added.");
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The image could not be uploaded.",
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function removeGalleryItem(itemId: string) {
    resetNotice();
    const response = await fetch(
      `/api/organizations/${organization.id}/media/${itemId}`,
      {
        method: "DELETE",
        credentials: "include",
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || "The gallery image could not be removed.");
      return;
    }
    setGallery((current) => current.filter(({ id }) => id !== itemId));
    setMessage("Gallery image removed.");
    router.refresh();
  }

  async function moveGalleryItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= gallery.length) return;
    const next = [...gallery];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setGallery(next);
    resetNotice();
    const response = await fetch(
      `/api/organizations/${organization.id}/media`,
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: next.map(({ id }) => id) }),
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setGallery(gallery);
      setError(data.error || "The gallery order could not be saved.");
      return;
    }
    setMessage("Gallery order saved.");
    router.refresh();
  }

  function resetNotice() {
    setError("");
    setMessage("");
  }

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
        <div className="grid gap-6 bg-kondo-forest p-5 text-white sm:p-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={status} />
              <span className="text-xs font-bold text-white/60">
                {readiness.profileCompletionSummary.percentage}% complete
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">
              Public profile
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              Control exactly what students can see. Legal identity, internal
              notes and private contacts are never exposed here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 text-sm font-black transition hover:bg-white/20"
              href={previewHref}
            >
              <Eye className="h-4 w-4" />
              Preview
            </Link>
            {status === "PUBLISHED" ? (
              <Link
                className="inline-flex h-11 items-center gap-2 rounded-full bg-kondo-lime px-4 text-sm font-black text-kondo-forest"
                href={publicHref}
              >
                <Globe2 className="h-4 w-4" />
                View public page
              </Link>
            ) : null}
          </div>
        </div>
        <div className="p-5 sm:p-7">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-kondo-green transition-[width]"
              style={{
                width: `${readiness.profileCompletionSummary.percentage}%`,
              }}
            />
          </div>
          {readiness.missingRequirements.length ||
          readiness.blockingReasons.length ? (
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {[
                ...readiness.blockingReasons,
                ...readiness.missingRequirements,
              ].map((item) => (
                <p
                  className="rounded-2xl bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-950 dark:bg-amber-400/10 dark:text-amber-100"
                  key={item.key}
                >
                  {item.message}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-4 inline-flex items-center gap-2 text-sm font-black text-kondo-green">
              <Check className="h-4 w-4" />
              Required publication information is complete.
            </p>
          )}
          {readiness.warnings.length ? (
            <details className="mt-4 rounded-2xl border border-border p-4">
              <summary className="cursor-pointer text-sm font-black">
                {readiness.warnings.length} optional improvement
                {readiness.warnings.length === 1 ? "" : "s"}
              </summary>
              <ul className="mt-3 grid gap-2 text-xs leading-5 text-muted-foreground">
                {readiness.warnings.map((warning) => (
                  <li key={warning.key}>• {warning.message}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </section>

      <ManagerSection
        description="This content appears in the hero and overview sections."
        title="Public story"
      >
        <div className="grid gap-4">
          <TextField
            label="Tagline"
            maxLength={160}
            onChange={(tagline) => setForm({ ...form, tagline })}
            placeholder="A concise promise to Kondo students"
            value={form.tagline}
          />
          <TextArea
            label="Short description"
            maxLength={500}
            onChange={(shortDescription) =>
              setForm({ ...form, shortDescription })
            }
            placeholder="Explain who you are and how you help."
            value={form.shortDescription}
          />
          <TextArea
            label="Extended description"
            maxLength={5000}
            onChange={(extendedDescription) =>
              setForm({ ...form, extendedDescription })
            }
            placeholder="Add useful background, approach and student-facing context."
            rows={7}
            value={form.extendedDescription}
          />
          <TextField
            label="Public general address"
            maxLength={300}
            onChange={(publicAddress) => setForm({ ...form, publicAddress })}
            placeholder="Optional — never add a private residential address"
            value={form.publicAddress}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Service areas"
              onChange={(serviceAreas) => setForm({ ...form, serviceAreas })}
              placeholder="Admissions, Career guidance"
              value={form.serviceAreas}
            />
            <TextField
              label="Supported languages"
              onChange={(supportedLanguages) =>
                setForm({ ...form, supportedLanguages })
              }
              placeholder="English, French, Mandarin"
              value={form.supportedLanguages}
            />
          </div>
          <label className="flex cursor-pointer gap-3 rounded-3xl border border-border bg-muted/30 p-4">
            <input
              checked={form.representationConfirmed}
              className="mt-1 h-4 w-4"
              onChange={(event) =>
                setForm({
                  ...form,
                  representationConfirmed: event.target.checked,
                })
              }
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-black">
                I am authorized to represent this organization
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                This confirmation is required before publication and is recorded
                for accountability.
              </span>
            </span>
          </label>
        </div>
      </ManagerSection>

      <ManagerSection
        description={`${publicContacts} public channel${publicContacts === 1 ? "" : "s"}. Private channels remain available only to the team.`}
        title="Contact channels"
      >
        <div className="grid gap-3">
          {contacts.map((contact, index) => (
            <div
              className="grid gap-3 rounded-3xl border border-border p-4 lg:grid-cols-[150px_1fr_1.5fr_120px_auto]"
              key={contact.id || `new-${index}`}
            >
              <select
                aria-label="Contact type"
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm font-bold"
                onChange={(event) =>
                  setContacts((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            type: event.target.value as OrganizationContactType,
                          }
                        : item,
                    ),
                  )
                }
                value={contact.type}
              >
                {CONTACT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <input
                aria-label="Contact label"
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                onChange={(event) =>
                  updateContact(index, "label", event.target.value, setContacts)
                }
                placeholder="Label"
                value={contact.label}
              />
              <input
                aria-label="Contact value"
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                onChange={(event) =>
                  updateContact(index, "value", event.target.value, setContacts)
                }
                placeholder="Professional contact"
                value={contact.value}
              />
              <select
                aria-label="Contact visibility"
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm font-bold"
                onChange={(event) =>
                  setContacts((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            visibility: event.target
                              .value as OrganizationContactVisibility,
                          }
                        : item,
                    ),
                  )
                }
                value={contact.visibility}
              >
                <option value="PUBLIC">Public</option>
                <option value="PRIVATE">Private</option>
              </select>
              <button
                aria-label="Remove contact channel"
                className="grid h-11 w-11 place-items-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                onClick={() =>
                  setContacts((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {contacts.length < 12 ? (
            <button
              className="inline-flex h-11 w-fit items-center gap-2 rounded-full border border-border px-4 text-sm font-black transition hover:border-kondo-green hover:text-kondo-green"
              onClick={() =>
                setContacts((current) => [
                  ...current,
                  {
                    type: "WEBSITE",
                    label: "",
                    value: "",
                    visibility: "PUBLIC",
                  },
                ])
              }
              type="button"
            >
              <Plus className="h-4 w-4" />
              Add contact channel
            </button>
          ) : null}
        </div>
      </ManagerSection>

      {canManageMedia ? (
        <ManagerSection
          description="Up to 12 JPG, PNG or WebP images. Every image requires a useful description."
          title="Public gallery"
        >
          <div className="grid gap-4 rounded-3xl bg-muted/30 p-4 sm:grid-cols-2">
            <TextField
              label="Image description"
              maxLength={240}
              onChange={setGalleryAlt}
              placeholder="Students speaking with an advisor"
              value={galleryAlt}
            />
            <TextField
              label="Caption (optional)"
              maxLength={240}
              onChange={setGalleryCaption}
              placeholder="Add helpful context"
              value={galleryCaption}
            />
            <label
              className={`inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-kondo-forest px-5 text-sm font-black text-white sm:col-span-2 ${
                uploading || gallery.length >= 12
                  ? "pointer-events-none opacity-60"
                  : ""
              }`}
            >
              <ImagePlus className="h-4 w-4" />
              {uploading
                ? `Uploading ${uploadProgress}%`
                : gallery.length >= 12
                  ? "Gallery limit reached"
                  : "Choose an image"}
              <input
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={uploading || gallery.length >= 12}
                onChange={uploadGalleryImage}
                type="file"
              />
            </label>
          </div>
          {uploading ? (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-kondo-green transition-[width]"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          ) : null}
          {gallery.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map((item, index) => (
                <div
                  className="overflow-hidden rounded-3xl border border-border"
                  key={item.id}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={item.altText}
                    className="aspect-[4/3] w-full bg-muted object-cover"
                    src={`/api/media/${item.mediaId}`}
                  />
                  <div className="p-3">
                    <p className="line-clamp-2 text-xs font-semibold">
                      {item.caption || item.altText}
                    </p>
                    <div className="mt-3 flex items-center gap-1">
                      <button
                        aria-label="Move image earlier"
                        className="grid h-9 w-9 place-items-center rounded-full border border-border disabled:opacity-30"
                        disabled={index === 0}
                        onClick={() => moveGalleryItem(index, -1)}
                        type="button"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        aria-label="Move image later"
                        className="grid h-9 w-9 place-items-center rounded-full border border-border disabled:opacity-30"
                        disabled={index === gallery.length - 1}
                        onClick={() => moveGalleryItem(index, 1)}
                        type="button"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        aria-label="Remove gallery image"
                        className="ml-auto grid h-9 w-9 place-items-center rounded-full text-destructive hover:bg-destructive/10"
                        onClick={() => removeGalleryItem(item.id)}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No gallery images yet. The public gallery stays hidden until one
              is added.
            </p>
          )}
        </ManagerSection>
      ) : null}

      {error ? (
        <p
          className="rounded-2xl bg-destructive/10 p-4 text-sm font-semibold text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          className="rounded-2xl bg-kondo-mint p-4 text-sm font-black text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <div className="sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-xl">
        <button
          className="inline-flex h-11 items-center gap-2 rounded-full bg-kondo-forest px-5 text-sm font-black text-white transition hover:bg-kondo-green disabled:opacity-60"
          disabled={saving}
          onClick={save}
          type="button"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save changes"}
        </button>
        {canPublish ? (
          status === "PUBLISHED" ? (
            <button
              className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-black transition hover:border-destructive hover:text-destructive disabled:opacity-60"
              disabled={publishing}
              onClick={() => changePublication("unpublish")}
              type="button"
            >
              <Lock className="h-4 w-4" />
              {publishing ? "Updating…" : "Unpublish"}
            </button>
          ) : (
            <button
              className="inline-flex h-11 items-center gap-2 rounded-full bg-kondo-lime px-5 text-sm font-black text-kondo-forest transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={publishing || !readiness.isReady}
              onClick={() => changePublication("publish")}
              type="button"
            >
              <Send className="h-4 w-4" />
              {publishing ? "Publishing…" : "Publish profile"}
            </button>
          )
        ) : (
          <p className="text-xs font-semibold text-muted-foreground">
            An owner or admin publishes the final profile.
          </p>
        )}
      </div>
    </div>
  );
}

function ManagerSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm sm:p-6">
      <h3 className="text-xl font-black tracking-tight">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value: fieldValue,
  onChange,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-black">{label}</span>
      <input
        {...props}
        className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-kondo-green focus:ring-4 focus:ring-kondo-green/10"
        onChange={(event) => onChange(event.target.value)}
        value={fieldValue}
      />
    </label>
  );
}

function TextArea({
  label,
  value: fieldValue,
  onChange,
  ...props
}: Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "onChange" | "value"
> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-black">{label}</span>
      <textarea
        {...props}
        className="min-h-28 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 outline-none transition focus:border-kondo-green focus:ring-4 focus:ring-kondo-green/10"
        onChange={(event) => onChange(event.target.value)}
        value={fieldValue}
      />
    </label>
  );
}

function StatusPill({ status }: { status: OrganizationPublicProfileStatus }) {
  const label: Record<OrganizationPublicProfileStatus, string> = {
    PRIVATE: "Private draft",
    READY: "Ready to publish",
    PUBLISHED: "Published",
    UNPUBLISHED: "Unpublished",
  };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.08em]">
      {status === "PUBLISHED" ? (
        <Globe2 className="h-3.5 w-3.5 text-kondo-lime" />
      ) : (
        <Lock className="h-3.5 w-3.5" />
      )}
      {label[status]}
    </span>
  );
}

function value(input: string) {
  return input.trim() || undefined;
}

function nullableValue(input: string) {
  return input.trim() || null;
}

function list(input: string) {
  return [
    ...new Set(
      input
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function updateContact(
  index: number,
  key: "label" | "value",
  nextValue: string,
  setter: React.Dispatch<React.SetStateAction<Contact[]>>,
) {
  setter((current) =>
    current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [key]: nextValue } : item,
    ),
  );
}
